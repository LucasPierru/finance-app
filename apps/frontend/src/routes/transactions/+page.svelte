<svelte:options runes={true} />

<script module lang="ts">
  import type { PagedTransactionsResult, TransactionSummary } from "@finance-app/shared-types";
  import { getMonthKey } from "$lib/utils/date";

  type CachedPage = { pagedTransactions: PagedTransactionsResult; txSummary: TransactionSummary };
  const txCache = new Map<string, CachedPage>();

  function makeCacheKey(f: {
    month: string; page: number; flow: string; search: string;
    minAmount: string; maxAmount: string; categoryId: string; subCategoryId: string;
    sortBy: string; sortDir: string;
  }): string {
    return `${f.month}|${f.page}|${f.flow}|${f.search}|${f.minAmount}|${f.maxAmount}|${f.categoryId}|${f.subCategoryId}|${f.sortBy}|${f.sortDir}`;
  }

  export function clearTransactionCache() {
    txCache.clear();
  }
</script>

<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import BankEntriesPanel from "$lib/components/transactions/BankEntriesPanel.svelte";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { httpPostPlaidSync } from "$lib/requests/plaid";
  import type { BankConnectionState, BankTransaction, PagedTransactionsResult, TransactionSummary } from "@finance-app/shared-types";
  import {
    emptyBankState,
    emptyFinanceState,
    getEffectiveFinanceView,
    categorizeBankTransaction,
    type CategorizedBankTransaction,
  } from "$lib/utils/finance-view";
  import { formatCurrency } from "$lib/utils/format";

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
    page.data.filters ?? { month: "", page: 1, flow: "", search: "", minAmount: "", maxAmount: "", categoryId: "", subCategoryId: "", sortBy: "", sortDir: "" },
  );
  let pagedTransactions = $state<PagedTransactionsResult | null>(page.data.pagedTransactions ?? null);
  let txSummary = $state<TransactionSummary | null>(page.data.txSummary ?? null);

  // Sync from server load results; cache past-month pages so revisiting them is instant.
  $effect(() => {
    const serverTx = page.data.pagedTransactions;
    const serverSummary = page.data.txSummary;
    const serverFilters = page.data.filters;
    if (!serverTx || !serverSummary || !serverFilters) return;
    pagedTransactions = serverTx;
    txSummary = serverSummary;
    if (serverFilters.month && serverFilters.month < getMonthKey(new Date())) {
      txCache.set(makeCacheKey(serverFilters), { pagedTransactions: serverTx, txSummary: serverSummary });
    }
  });

  const categorizedPagedTransactions = $derived(
    (pagedTransactions?.transactions ?? [] as BankTransaction[]).map((tx) =>
      categorizeBankTransaction(tx, allCategories),
    ),
  );

  function navigate(patch: Record<string, string | number>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value === null || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    if (!("page" in patch)) params.set("page", "1");

    const targetMonth = params.get("month") || getMonthKey(new Date());
    if (targetMonth < getMonthKey(new Date())) {
      const key = makeCacheKey({
        month: targetMonth,
        page: Number(params.get("page") || 1),
        flow: params.get("flow") || "",
        search: params.get("search") || "",
        minAmount: params.get("minAmount") || "",
        maxAmount: params.get("maxAmount") || "",
        categoryId: params.get("categoryId") || "",
        subCategoryId: params.get("subCategoryId") || "",
        sortBy: params.get("sortBy") || "",
        sortDir: params.get("sortDir") || "",
      });
      const cached = txCache.get(key);
      if (cached) {
        pagedTransactions = cached.pagedTransactions;
        txSummary = cached.txSummary;
      }
    }

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
    txCache.clear();
    const payload = await httpPostPlaidSync();
    bankState = {
      ...bankState,
      connected: true,
      institutionName: payload.institutionName,
      lastSyncAt: payload.lastSyncAt,
      accounts: payload.accounts,
      recentTransactions: payload.recentTransactions,
    };
    await invalidateAll();
  }

  function handleTransactionUpdated(_updated: { transactionId: string }) {
    // Trigger a page reload to re-fetch paged transactions with the new category
    goto(page.url, { replaceState: true, invalidateAll: true });
  }

  function handleTransactionDeleted(_transactionId: string) {
    goto(page.url, { replaceState: true, invalidateAll: true });
  }

  function handleTransactionCreated() {
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
  {#if bankState.connected}
    <div class="mb-4 md:hidden">
      <SegmentedControl
        items={[
          { id: "transactions", label: "Transactions", href: `?view=transactions` },
          { id: "recurring", label: "Recurring", href: `?view=recurring` },
        ]}
        active={viewMode}
      />
    </div>
  {/if}

  <MonthNavigation value={filters.month} onchange={handleMonthChange} />

  <div class="grid grid-cols-2 gap-3 mt-4 mb-5">
    <Card>
      <CardHeader class="p-3 pb-2 md:p-5 md:pb-2">
        <CardDescription class="text-xs md:text-sm">Income</CardDescription>
        <CardTitle class="text-lg md:text-2xl text-emerald-400">{formatCurrency(txSummary?.totalIncome ?? 0)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader class="p-3 pb-2 md:p-5 md:pb-2">
        <CardDescription class="text-xs md:text-sm">Expenses</CardDescription>
        <CardTitle class="text-lg md:text-2xl text-rose-400">{formatCurrency(txSummary?.totalExpenses ?? 0)}</CardTitle>
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
    filters={{ flow: filters.flow, search: searchInput, minAmount: filters.minAmount, maxAmount: filters.maxAmount, categoryId: filters.categoryId, subCategoryId: filters.subCategoryId, sortBy: filters.sortBy, sortDir: filters.sortDir }}
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
    onTransactionCreated={handleTransactionCreated}
    onTransactionUpdated={handleTransactionUpdated}
    onTransactionDeleted={handleTransactionDeleted}
  />
</div>
