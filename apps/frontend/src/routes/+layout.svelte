<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import type { Snippet } from "svelte";
  import "../app.css";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import BottomNavigationBar from "$lib/components/BottomNavigationBar.svelte";
  import FloatingActionButton from "$lib/components/FloatingActionButton.svelte";
  import { initializeAuth } from "$lib/stores/auth";
  import { initializeTheme } from "$lib/stores/theme";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";
  import { bankState as bankingStore, bankLoading, syncBankData } from "$lib/stores/banking";
  import { createTransactionRequest } from "$lib/stores/ui";
  import PullToRefresh from "$lib/components/PullToRefresh.svelte";

  const SYNC_THROTTLE_MS = 60 * 60 * 1000;

  let { children }: { children: Snippet } = $props();
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState, page.data.allCategories ?? []));

  const currentPathname = $derived(String(page.url.pathname));
  const isAuthRoute = $derived(currentPathname === "/login" || currentPathname === "/register");

  const activeMobileInnerNav = $derived(
    page.url.searchParams.get("view") === "recurring" ? "recurring" : "transactions"
  );

  function shouldSync(lastSyncAt: string | null): boolean {
    const lastSync = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    return Date.now() - lastSync > SYNC_THROTTLE_MS;
  }

  onMount(() => {
    void (async () => {
      initializeTheme();
      await initializeAuth();

      const initial = page.data.initialBankState;
      if (initial?.connected) {
        const sessionKey = "plaid_synced";
        const syncedThisSession = sessionStorage.getItem(sessionKey) === "1";
        if (!syncedThisSession || shouldSync(initial.lastSyncAt)) {
          sessionStorage.setItem(sessionKey, "1");
          void syncBankData();
        }
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
      <BottomNavigationBar />
      <!-- Floating + button: must live here, outside overflow-y-auto, so position:fixed works on mobile -->
      {#if currentPathname === "/transactions" && activeMobileInnerNav === "transactions"}
        <FloatingActionButton
          onclick={() => createTransactionRequest.update((n) => n + 1)}
          ariaLabel="Add transaction"
        />
      {:else if currentPathname === "/budget"}
        <FloatingActionButton href="/budget/new" ariaLabel="Create budget" />
      {/if}
      <div class="w-full overflow-y-auto md:flex-1 md:overflow-x-hidden">
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
