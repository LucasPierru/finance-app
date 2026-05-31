<svelte:options runes={true} />

<script lang="ts">
  interface NavItem {
    id: string;
    label: string;
    href: string;
  }

  let {
    items,
    active,
  }: {
    items: NavItem[];
    active: string;
  } = $props();

  const cappedItems = $derived(items.slice(0, 3));
  const activeIndex = $derived(
    Math.max(0, cappedItems.findIndex((item) => item.id === active))
  );

  let itemRefs: (HTMLElement | null)[] = $state(Array(3).fill(null));
  let pillLeft = $state(0);
  let pillWidth = $state(0);

  $effect(() => {
    const el = itemRefs[activeIndex];
    if (!el) return;
    pillLeft = el.offsetLeft;
    pillWidth = el.offsetWidth;
  });
</script>

<nav
  class="sticky top-0 z-30 px-4 py-2 md:hidden"
  aria-label="Page navigation"
>
  <div class="glass relative rounded-xl px-1">
    <!-- sliding pill -->
    {#if pillWidth > 0}
      <span
        class="pointer-events-none absolute top-1 z-[2] rounded-lg bg-white/15 border border-white/25
               shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
        style="left: {pillLeft}px; width: {pillWidth}px; height: calc(100% - 0.5rem);
               transition: left 280ms cubic-bezier(0.16,1,0.3,1), width 180ms cubic-bezier(0.16,1,0.3,1);"
        aria-hidden="true"
      ></span>
    {/if}

    <div class="relative grid" style="grid-template-columns: repeat({cappedItems.length}, minmax(0, 1fr));">
      {#each cappedItems as item, i (item.id)}
        <a
          bind:this={itemRefs[i]}
          href={item.href}
          class="relative z-10 flex h-10 items-center justify-center px-3 text-sm font-semibold transition-colors duration-200
                 {active === item.id ? 'text-wf-text' : 'text-wf-muted1'}"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </div>
</nav>
