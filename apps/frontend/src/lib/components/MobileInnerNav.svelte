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
    Math.max(
      0,
      cappedItems.findIndex((item) => item.id === active),
    ),
  );
  const pillWidth = $derived(100 / cappedItems.length);
</script>

<nav
  class="sticky top-0 z-30 border-b border-wf-border bg-wf-sidebar px-3 py-2 backdrop-blur-md md:hidden"
  aria-label="Page navigation"
>
  <div class="relative">
    <!-- sliding pill -->
    <span
      class="pointer-events-none absolute inset-y-0 rounded-md bg-wf-surface2 transition-transform duration-300 ease-[cubic-bezier(0.35,0,0.25,1)]"
      style="width: {pillWidth}%; transform: translateX({activeIndex * 100}%);"
      aria-hidden="true"
    ></span>

    <div class="relative grid" style="grid-template-columns: repeat({cappedItems.length}, minmax(0, 1fr));">
      {#each cappedItems as item (item.id)}
        <a
          href={item.href}
          class="flex h-11 items-center justify-center px-3 text-sm font-semibold transition-colors duration-200 {active ===
          item.id
            ? 'text-wf-text'
            : 'text-wf-muted1'}"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </div>
</nav>
