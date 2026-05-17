<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import "../app.css";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import MobileInnerNav from "$lib/components/MobileInnerNav.svelte";
  import { initializeAuth } from "$lib/stores/auth";
  import { initializeTheme } from "$lib/stores/theme";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  let { children }: { children: Snippet } = $props();
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));

  const currentPathname = $derived(String(page.url.pathname));
  const isAuthRoute = $derived(currentPathname === "/login" || currentPathname === "/register");

  const mobileInnerNavItems = $derived.by(() => {
    if (currentPathname === "/") {
      return [
        { id: "overview", label: "Overview", href: "/?tab=overview" },
        { id: "expenses", label: "Expenses", href: "/?tab=expenses" },
        { id: "transactions", label: "Transactions", href: "/?tab=transactions" },
      ];
    }

    if (currentPathname === "/transactions") {
      return [
        { id: "transactions", label: "Transactions", href: "/transactions?view=transactions" },
        { id: "recurring", label: "Recurring", href: "/transactions?view=recurring" },
      ];
    }

    if (currentPathname === "/budget") {
      return [
        { id: "overview", label: "Overview", href: "/budget?section=overview" },
        { id: "categories", label: "Categories", href: "/budget?section=categories" },
        { id: "insights", label: "Insights", href: "/budget?section=insights" },
      ];
    }

    return [];
  });

  const activeMobileInnerNav = $derived.by(() => {
    if (currentPathname === "/") {
      const value = page.url.searchParams.get("tab");
      return value === "expenses" || value === "transactions" ? value : "overview";
    }

    if (currentPathname === "/transactions") {
      return page.url.searchParams.get("view") === "recurring" ? "recurring" : "transactions";
    }

    if (currentPathname === "/budget") {
      const value = page.url.searchParams.get("section");
      return value === "categories" || value === "insights" ? value : "overview";
    }

    return "";
  });

  onMount(() => {
    void (async () => {
      initializeTheme();
      await initializeAuth();
    })();
  });
</script>

<div class="h-screen overflow-hidden bg-[#0d0f14] text-slate-100 font-sans">
  {#if isAuthRoute}
    <main class="h-full w-full overflow-y-auto">{@render children?.()}</main>
  {:else}
    <div class="flex h-full">
      <AppSidebar monthlySurplus={financeView.monthlySurplus} />
      <div class="w-full overflow-y-auto md:flex-1 md:overflow-x-hidden">
        {#if mobileInnerNavItems.length > 0}
          <MobileInnerNav items={mobileInnerNavItems} active={activeMobileInnerNav} />
        {/if}
        <main
          class="mx-auto w-full max-w-7xl px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-8 md:pb-8 lg:px-8"
        >
          {@render children?.()}
        </main>
      </div>
    </div>
  {/if}
</div>
