<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import BankEntriesPanel from "$lib/components/transactions/BankEntriesPanel.svelte";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { apiRequest } from "$lib/api/client";
  import type { BankConnectionState } from "@finance-app/shared-types";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  type MonthlyTransactionGroup = {
    key: string;
    label: string;
    items: ReturnType<typeof getEffectiveFinanceView>["categorizedBankTransactions"];
  };

  type TransactionsViewMode = "transactions" | "recurring";

  let selectedMonthKey = $state("");
  let viewMode = $state<TransactionsViewMode>("transactions");
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  let bankState = $state<BankConnectionState>(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));
  const bankIsSynced = $derived(Boolean(bankState.connected && bankState.lastSyncAt));
  const bankHasSyncedData = $derived(
    Boolean(
      bankState.connected &&
        bankState.lastSyncAt &&
        (bankState.accounts.length > 0 || bankState.recentTransactions.length > 0),
    ),
  );

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  function getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function parseLocalCalendarDate(dateValue: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);

    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  const currentMonthKey = $derived(getMonthKey(new Date()));

  function groupTransactionsByMonth() {
    const groups = new Map<string, MonthlyTransactionGroup>();

    for (const transaction of financeView.categorizedBankTransactions) {
      const parsedDate = parseLocalCalendarDate(transaction.date);
      if (!parsedDate) continue;
      if (Number.isNaN(parsedDate.getTime())) continue;

      const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`;
      const label = parsedDate.toLocaleString("en-US", { month: "long", year: "numeric" });
      const existing = groups.get(key);

      if (existing) {
        existing.items.push(transaction);
      } else {
        groups.set(key, {
          key,
          label,
          items: [transaction],
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
  }

  const syncedTransactionsByMonth = $derived(groupTransactionsByMonth());

  const monthFilterOptions = $derived([
    ...syncedTransactionsByMonth.map((group) => ({ value: group.key, label: group.label })),
  ]);

  const selectedOrCurrentMonthKey = $derived(selectedMonthKey || currentMonthKey);

  const selectedMonthGroup = $derived(
    syncedTransactionsByMonth.find((group) => group.key === selectedOrCurrentMonthKey) ?? null,
  );

  const selectedMonthItems = $derived(selectedMonthGroup?.items ?? []);

  const selectedMonthIncome = $derived(
    selectedMonthItems
      .filter((transaction) => transaction.flow === "income")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
  );

  const selectedMonthExpenses = $derived(
    selectedMonthItems
      .filter((transaction) => transaction.flow === "expense")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
  );

  const selectedMonthLabel = $derived(
    monthFilterOptions.find((option) => option.value === selectedOrCurrentMonthKey)?.label ?? "Current Month",
  );

  async function syncBankData() {
    const payload = await apiRequest<BankConnectionState>("/api/plaid/sync", {
      method: "POST",
    });

    bankState = {
      ...bankState,
      connected: true,
      institutionName: payload.institutionName,
      lastSyncAt: payload.lastSyncAt,
      accounts: payload.accounts,
      recentTransactions: payload.recentTransactions,
    };
  }

  function handleMonthFilterChange(value: string) {
    selectedMonthKey = value;
  }

  onMount(() => {
    hydrateFinanceState(page.data.initialFinanceState);
    selectedMonthKey = currentMonthKey;
  });

  $effect(() => {
    const view = page.url.searchParams.get("view");
    const resolved: TransactionsViewMode = view === "recurring" ? "recurring" : "transactions";
    if (viewMode !== resolved) {
      viewMode = resolved;
    }
  });
</script>

<div class="animate-fade-up">
  <MonthNavigation bind:value={selectedMonthKey} />

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-5">
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Income ({selectedMonthLabel})</CardDescription>
        <CardTitle class="text-2xl text-emerald-400">{fmt(selectedMonthIncome)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Expenses ({selectedMonthLabel})</CardDescription>
        <CardTitle class="text-2xl text-rose-400">{fmt(selectedMonthExpenses)}</CardTitle>
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
    {selectedMonthLabel}
    transactions={selectedMonthItems}
    recurringEntries={financeView.recurringBankEntries}
    onRefresh={syncBankData}
    onModeChange={(next) => {
      viewMode = next;
    }}
  />
</div>
