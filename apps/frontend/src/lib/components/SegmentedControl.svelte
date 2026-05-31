<svelte:options runes={true} />

<script lang="ts">
  interface Item {
    id: string;
    label: string;
    href: string;
  }

  let { items, active }: { items: Item[]; active: string } = $props();

  const activeIndex = $derived(
    Math.max(
      0,
      items.findIndex((i) => i.id === active),
    ),
  );

  let itemRefs: (HTMLElement | null)[] = $state(Array(items.length).fill(null));
  let pillLeft = $state(0);
  let pillWidth = $state(0);

  $effect(() => {
    const el = itemRefs[activeIndex];
    if (!el) return;
    pillLeft = el.offsetLeft;
    pillWidth = el.offsetWidth;
  });
</script>

<div class="relative p-1 md:hidden">
  {#if pillWidth > 0}
    <div
      class="pointer-events-none absolute top-1 z-[2] rounded-lg glass-pill"
      style="left: {pillLeft}px; width: {pillWidth}px; height: calc(100% - 0.5rem);
             transition: left 280ms cubic-bezier(0.16,1,0.3,1), width 180ms cubic-bezier(0.16,1,0.3,1);"
    ></div>
  {/if}

  <div class="grid" style="grid-template-columns: repeat({items.length}, minmax(0, 1fr));">
    {#each items as item, i (item.id)}
      <a
        bind:this={itemRefs[i]}
        href={item.href}
        class="relative z-10 flex h-9 items-center justify-center text-sm font-semibold
               transition-colors duration-200
               {item.id === active ? 'text-wf-text' : 'text-wf-muted1'}"
      >
        {item.label}
      </a>
    {/each}
  </div>
</div>
