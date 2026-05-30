<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    onRefresh: () => Promise<void>;
    disabled?: boolean;
    children: Snippet;
  }

  let { onRefresh, disabled = false, children }: Props = $props();

  // pullY (visual px) needed to trigger
  const THRESHOLD = 68;
  // maximum visual pull distance
  const MAX_PULL = 92;
  // height the gap locks at while the request is in-flight
  const LOCK_HEIGHT = 56;

  let rootEl: HTMLDivElement;
  let scrollEl: HTMLElement;

  let pulling = $state(false);
  let refreshing = $state(false);
  let pullY = $state(0);

  let touchStartY = 0;
  let active = false;

  function findScrollParent(el: HTMLElement): HTMLElement {
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll') return node;
      node = node.parentElement;
    }
    return document.documentElement as HTMLElement;
  }

  function onTouchStart(e: TouchEvent) {
    if (disabled || refreshing) return;
    if ((scrollEl?.scrollTop ?? 0) > 0) return;
    touchStartY = e.touches[0].clientY;
    active = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!active || refreshing) return;
    if ((scrollEl?.scrollTop ?? 0) > 1) {
      active = false;
      pulling = false;
      pullY = 0;
      return;
    }

    const dy = e.touches[0].clientY - touchStartY;
    if (dy <= 0) {
      if (pulling) { pulling = false; pullY = 0; }
      return;
    }

    e.preventDefault();
    pulling = true;
    // sqrt gives rubber-band deceleration: fast at first, slows past threshold
    pullY = Math.min(MAX_PULL, Math.pow(dy, 0.75) * 2.2);
  }

  async function onTouchEnd() {
    if (!active) return;
    active = false;
    if (!pulling) return;
    pulling = false;

    if (pullY >= THRESHOLD) {
      refreshing = true;
      pullY = LOCK_HEIGHT;
      try { await onRefresh(); } finally {
        refreshing = false;
        pullY = 0;
      }
    } else {
      pullY = 0;
    }
  }

  onMount(() => {
    scrollEl = findScrollParent(rootEl);
    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
    };
  });

  const canRelease = $derived(pulling && pullY >= THRESHOLD);
  const iconRotation = $derived(!refreshing ? Math.min(360, (pullY / THRESHOLD) * 360) : 0);
  const isActive = $derived(pulling || refreshing);
</script>

<div bind:this={rootEl} class="relative">
  <!--
    Indicator sits at the top of rootEl and is revealed as the content below
    translates down. Height always matches pullY so it exactly fills the gap.
  -->
  <div
    class="absolute inset-x-0 top-0 flex items-center justify-center gap-2 overflow-hidden"
    style="height: {pullY}px;"
    aria-hidden="true"
  >
    {#if isActive}
      <RefreshCw
        size={14}
        class="shrink-0 text-primary {refreshing ? 'animate-spin' : ''}"
        style={refreshing ? '' : `transform: rotate(${iconRotation}deg); transition: none;`}
      />
      <span class="text-xs font-medium text-muted-foreground">
        {canRelease ? 'Release to refresh' : 'Refresh data'}
      </span>
    {/if}
  </div>

  <!-- Page content slides down to open the gap above -->
  <div style="transform: translateY({pullY}px); transition: {pulling ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'};">
    {@render children()}
  </div>
</div>
