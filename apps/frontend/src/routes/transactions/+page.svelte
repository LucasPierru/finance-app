<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import BankEntriesPanel from "$lib/components/transactions/BankEntriesPanel.svelte";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { httpPostPlaidSync } from "$lib/requests/plaid";
  import type { BankConnectionState } from "@finance-app/shared-types";
  import {
    emptyBankState,
    emptyFinanceState,
    getEffectiveFinanceView,
    categorizeBankTransaction,
    type CategorizedBankTransaction,
  } from "$lib/utils/finance-view";

  type TransactionsViewMode = "transactions" | "recurring";

  let viewMode = $state<TransactionsViewMode>("transactions");
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  let bankState = $state<BankConnectionState>(page.data.initialBankState ?? emptyBankState);
  const allCategories = $derived(page.data.allCategories ?? []);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState, allCategories));
  const bankIsSynced = $derived(Boolean(bankState.connected && bankState.lastSyncAt));
  const bankHasSyncedData = $derived(
    Boolean(
      bankState.connected &&
        bankState.lastSyncAt &&
        (bankState.accounts.length > 0 || bankState.recentTransactions.length > 0),
    ),
  );

  const filters = $derived(
    page.data.filters ?? { month: "", page: 1, flow: "", search: "", minAmount: "", maxAmount: "" },
  );
  const pagedTransactions = $derived(page.data.pagedTransactions ?? null);
  const txSummary = $derived(page.data.txSummary ?? null);
  const categorizedPagedTransactions = $derived(
    ((pagedTransactions?.transactions ?? []) as import("@finance-app/shared-types").BankTransaction[]).map((tx) =>
      categorizeBankTransaction(tx, allCategories),
    ),
  );

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  function navigate(patch: Record<string, string | number>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value === null || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    // Reset page to 1 when non-page param changes
    if (!("page" in patch)) params.set("page", "1");
    goto(`?${params}`, { replaceState: false, keepFocus: true });
  }

  function handleMonthChange(month: string) {
    navigate({ month });
  }

  function handlePageChange(newPage: number) {
    navigate({ page: newPage });
  }

  let searchInput = $state("");
  // Keep search input in sync with URL (e.g. back/forward navigation)
  $effect(() => {
    searchInput = filters.search;
  });
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  function handleSearchInput(value: string) {
    searchInput = value;
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => navigate({ search: value }), 400);
  }

  async function syncBankData() {
    const payload = await httpPostPlaidSync();
    bankState = {
      ...bankState,
      connected: true,
      institutionName: payload.institutionName,
      lastSyncAt: payload.lastSyncAt,
      accounts: payload.accounts,
      recentTransactions: payload.recentTransactions,
    };
  }

  function handleTransactionUpdated(_updated: { transactionId: string }) {
    // Trigger a page reload to re-fetch paged transactions with the new category
    goto(page.url, { replaceState: true, invalidateAll: true });
  }

  function handleTransactionDeleted(_transactionId: string) {
    goto(page.url, { replaceState: true, invalidateAll: true });
  }

  onMount(() => {
    hydrateFinanceState(page.data.initialFinanceState);
    searchInput = filters.search;
  });

  $effect(() => {
    const view = page.url.searchParams.get("view");
    const resolved: TransactionsViewMode = view === "recurring" ? "recurring" : "transactions";
    if (viewMode !== resolved) viewMode = resolved;
  });
</script>

<div class="animate-fade-up">
  <MonthNavigation value={filters.month} onchange={handleMonthChange} />

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-5">
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Income</CardDescription>
        <CardTitle class="text-2xl text-emerald-400">{fmt(txSummary?.totalIncome ?? 0)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Expenses</CardDescription>
        <CardTitle class="text-2xl text-rose-400">{fmt(txSummary?.totalExpenses ?? 0)}</CardTitle>
      </CardHeader>
    </Card>
  </div>

  {#if !bankState.connected}
    <Card class="mb-5">
      <CardHeader>
        <CardTitle>Manual Transactions</CardTitle>
        <CardDescription>
          No bank connected. Add your income and expense entries manually from this page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EntryFormCard variant="income" />
        <EntryFormCard variant="expense" />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <FinanceListCard variant="income" />
          <FinanceListCard variant="expense" />
        </div>
      </CardContent>
    </Card>
  {/if}

  <BankEntriesPanel
    connected={bankState.connected}
    synced={bankIsSynced}
    hasSyncedData={bankHasSyncedData}
    mode={viewMode}
    selectedMonthLabel={filters.month}
    transactions={categorizedPagedTransactions}
    recurringEntries={financeView.recurringBankEntries}
    categories={allCategories}
    serverPage={pagedTransactions?.page ?? 1}
    serverTotalPages={pagedTransactions?.totalPages ?? 1}
    serverTotal={pagedTransactions?.total ?? 0}
    filters={{ flow: filters.flow, search: searchInput, minAmount: filters.minAmount, maxAmount: filters.maxAmount }}
    onRefresh={syncBankData}
    onModeChange={(next) => {
      viewMode = next;
      goto(`?${new URLSearchParams({ ...Object.fromEntries(page.url.searchParams), view: next })}`, {
        replaceState: false,
      });
    }}
    onPageChange={handlePageChange}
    onFilterChange={(patch) => navigate(patch)}
    onSearchInput={handleSearchInput}
    onTransactionUpdated={handleTransactionUpdated}
    onTransactionDeleted={handleTransactionDeleted}
  />
</div>
