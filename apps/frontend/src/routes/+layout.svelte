<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import "../app.css";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import { initializeAuth } from "$lib/stores/auth";
  import { initializeTheme } from "$lib/stores/theme";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  let { children }: { children: Snippet } = $props();
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));

  const currentPathname = $derived(String(page.url.pathname));
  const isAuthRoute = $derived(currentPathname === "/login" || currentPathname === "/register");

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
        <div class="md:hidden h-16"></div>
        <main class="max-w-7xl mx-auto w-full px-5">
          {@render children?.()}
        </main>
      </div>
    </div>
  {/if}
</div>
