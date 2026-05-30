<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import type { Snippet } from "svelte";
  import "../app.css";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import MobileInnerNav from "$lib/components/MobileInnerNav.svelte";
  import { initializeAuth } from "$lib/stores/auth";
  import { initializeTheme } from "$lib/stores/theme";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";
  import { bankState as bankingStore, bankLoading, syncBankData } from "$lib/stores/banking";
  import { createTransactionRequest } from "$lib/stores/ui";
  import { Plus } from "lucide-svelte";
  import PullToRefresh from "$lib/components/PullToRefresh.svelte";

  const SYNC_THROTTLE_MS = 60 * 60 * 1000;

  let { children }: { children: Snippet } = $props();
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState, page.data.allCategories ?? []));

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

  function shouldSync(lastSyncAt: string | null): boolean {
    const lastSync = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    return Date.now() - lastSync > SYNC_THROTTLE_MS;
  }

  onMount(() => {
    void (async () => {
      initializeTheme();
      await initializeAuth();

      // Sync on initial load if bank is connected and data is stale
      const initial = page.data.initialBankState;
      if (initial?.connected && shouldSync(initial.lastSyncAt)) {
        void syncBankData();
      }
    })();

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const state = get(bankingStore);
      if (!state.connected) return;
      if (shouldSync(state.lastSyncAt)) {
        void syncBankData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
</script>

<!-- Indeterminate progress bar while any bank sync is in progress -->
{#if $bankLoading}
  <div class="fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden bg-primary/15" aria-hidden="true">
    <div class="h-full bg-primary animate-progress-bar"></div>
  </div>
{/if}

<div class="h-screen overflow-hidden bg-wf-bg text-wf-text font-sans">
  {#if isAuthRoute}
    <main class="h-full w-full overflow-y-auto">{@render children?.()}</main>
  {:else}
    <div class="flex h-full">
      <AppSidebar monthlySurplus={financeView.monthlySurplus} />
      <!-- Floating + button: must live here, outside overflow-y-auto, so position:fixed works on mobile -->
      {#if currentPathname === "/transactions" && activeMobileInnerNav === "transactions"}
        <button
          onclick={() => createTransactionRequest.update((n) => n + 1)}
          class="fixed bottom-20 right-4 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90 md:hidden"
          aria-label="Add transaction"
        >
          <Plus class="h-6 w-6" />
        </button>
      {/if}
      <div class="w-full overflow-y-auto md:flex-1 md:overflow-x-hidden">
        {#if mobileInnerNavItems.length > 0}
          <MobileInnerNav items={mobileInnerNavItems} active={activeMobileInnerNav} />
        {/if}
        <main
          class="mx-auto w-full max-w-7xl px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-8 md:pb-8 lg:px-8"
        >
          <PullToRefresh onRefresh={syncBankData} disabled={!$bankingStore.connected}>
            {@render children?.()}
          </PullToRefresh>
        </main>
      </div>
    </div>
  {/if}
</div>
