<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { LayoutDashboard, TrendingUp, ArrowLeftRight, Settings, PiggyBank } from "lucide-svelte";

  const navItems = [
    { label: "Overview", path: "/", icon: LayoutDashboard },
    { label: "Budget", path: "/budget", icon: PiggyBank },
    { label: "Projection", path: "/projection", icon: TrendingUp },
    { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const activeIndex = $derived(
    navItems.findIndex((item) =>
      item.path === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(item.path)
    )
  );

  let navItemRefs: (HTMLElement | null)[] = $state(Array(navItems.length).fill(null));
  let pillLeft = $state(0);
  let pillWidth = $state(0);

  $effect(() => {
    const el = navItemRefs[activeIndex];
    if (!el) return;
    pillLeft = el.offsetLeft;
    pillWidth = el.offsetWidth;
  });
</script>

<nav
  class="fixed left-1/2 z-[55] -translate-x-1/2 md:hidden"
  style="width: calc(100vw - 1.5rem); bottom: max(1.25rem, calc(0.75rem + env(safe-area-inset-bottom)));"
  aria-label="Mobile navigation"
>
  <div
    class="glass relative flex items-center gap-0.5 rounded-2xl px-1.5 py-1.5
           shadow-[0_2px_16px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(255,255,255,0.08)]"
  >
    <!-- Sliding active pill -->
    {#if pillWidth > 0}
      <div
        class="pointer-events-none absolute top-1.5 z-[2] rounded-xl glass-pill
               shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
        style="left: {pillLeft}px; width: {pillWidth}px; height: calc(100% - 0.75rem);
               transition: left 280ms cubic-bezier(0.16,1,0.3,1), width 180ms cubic-bezier(0.16,1,0.3,1);"
      ></div>
    {/if}

    {#each navItems as item, i}
      <a
        bind:this={navItemRefs[i]}
        href={item.path}
        class="relative z-10 flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-medium
               transition-colors duration-200
               {i === activeIndex ? 'text-wf-text' : 'text-wf-muted1 hover:text-wf-text'}"
      >
        <item.icon class="h-5 w-5 transition-transform duration-200 {i === activeIndex ? 'scale-110' : 'scale-100'}" />
        <span>{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
