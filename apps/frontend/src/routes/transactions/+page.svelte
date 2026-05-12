<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { Select } from "$lib/components/ui/select";
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
  import { apiRequest } from "$lib/api/client";
  import type { BankConnectionState } from "$lib/types/banking";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  type MonthlyTransactionGroup = {
    key: string;
    label: string;
    items: ReturnType<typeof getEffectiveFinanceView>["categorizedBankTransactions"];
  };

  let selectedMonthKey = $state("");
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

  function fmtCurrency(n: number, currencyCode: string | null): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      maximumFractionDigits: 2,
    }).format(n);
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

  function handleMonthFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedMonthKey = target.value;
  }

  onMount(() => {
    hydrateFinanceState(page.data.initialFinanceState);
    selectedMonthKey = currentMonthKey;
  });

  $effect(() => {
    if (!selectedMonthKey) return;
    const exists = syncedTransactionsByMonth.some((group) => group.key === selectedMonthKey);
    if (!exists) {
      selectedMonthKey = currentMonthKey;
    }
  });
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Transactions" subtitle="Current month first, with month-by-month history" />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
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

    <Card class="mt-5">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Synced Transactions</CardTitle>
            <CardDescription>
              {#if !bankState.connected}
                Connect a bank account in Settings to unlock month-by-month transaction history.
              {:else}
                Browsing {selectedMonthLabel} transactions.
              {/if}
            </CardDescription>
          </div>
          {#if bankState.connected}
            <Button variant="outline" onclick={syncBankData}>Refresh</Button>
          {/if}
        </div>
      </CardHeader>
      <CardContent class="p-0">
        {#if !bankState.connected}
          <p class="px-5 py-10 text-sm text-center text-slate-500">No bank connected yet.</p>
        {:else if !bankIsSynced}
          <p class="px-5 py-10 text-sm text-center text-slate-500">Syncing bank data...</p>
        {:else if !bankHasSyncedData}
          <p class="px-5 py-10 text-sm text-center text-slate-500">No synced transactions yet. Click refresh.</p>
        {:else}
          <div class="space-y-4 px-5 pb-4">
            <div class="flex items-center gap-3">
              <p class="text-sm text-slate-400">Month</p>
              <Select class="w-full max-w-xs" value={selectedOrCurrentMonthKey} onchange={handleMonthFilterChange}>
                {#each monthFilterOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </Select>
            </div>

            <div class="rounded-md border border-[#252a3a] overflow-hidden">
              <div class="bg-[#1c2030] border-b border-[#252a3a] px-4 py-2.5">
                <p class="text-sm font-semibold text-slate-300">{selectedMonthLabel}</p>
              </div>
              <div class="overflow-x-auto">
                <Table class="min-w-[760px]">
                  <TableHeader class="border-b border-[#252a3a] bg-[#1c2030]">
                    <TableRow class="border-none">
                      <TableHead class="px-5 py-3">Date</TableHead>
                      <TableHead class="px-5 py-3">Name</TableHead>
                      <TableHead class="px-5 py-3">Merchant</TableHead>
                      <TableHead class="px-5 py-3">Category</TableHead>
                      <TableHead class="px-5 py-3">Pending</TableHead>
                      <TableHead class="px-5 py-3">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {#if selectedMonthItems.length === 0}
                      <TableRow>
                        <td colspan="6" class="px-5 py-8 text-center text-slate-500">
                          No transactions for this month.
                        </td>
                      </TableRow>
                    {:else}
                      {#each selectedMonthItems as tx (tx.transactionId)}
                        <TableRow class="hover:bg-[#1c2030]">
                          <TableCell class="px-5 py-3 text-slate-400">{tx.date}</TableCell>
                          <TableCell class="px-5 py-3 text-slate-200">{tx.name}</TableCell>
                          <TableCell class="px-5 py-3 text-slate-400">{tx.merchantName ?? "-"}</TableCell>
                          <TableCell class="px-5 py-3 text-slate-400">{tx.resolvedCategory}</TableCell>
                          <TableCell class="px-5 py-3 text-slate-400">{tx.pending ? "Yes" : "No"}</TableCell>
                          <TableCell
                            class="px-5 py-3 font-semibold {tx.flow === 'income'
                              ? 'text-emerald-400'
                              : 'text-rose-400'}"
                          >
                            {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                          </TableCell>
                        </TableRow>
                      {/each}
                    {/if}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        {/if}
      </CardContent>
    </Card>

    {#if bankState.connected}
      <Card class="mt-5">
        <CardHeader>
          <CardTitle>Detected Recurring Entries</CardTitle>
          <CardDescription>Likely weekly/biweekly/monthly/quarterly patterns from synced transactions.</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          {#if !bankIsSynced}
            <p class="px-5 py-8 text-sm text-center text-slate-500">Recurring detection starts after sync.</p>
          {:else if financeView.recurringBankEntries.length === 0}
            <p class="px-5 py-8 text-sm text-center text-slate-500">No recurring entries detected yet.</p>
          {:else}
            <div class="overflow-x-auto">
              <Table class="min-w-[720px]">
                <TableHeader class="border-y border-[#252a3a] bg-[#1c2030]">
                  <TableRow class="border-none">
                    <TableHead class="px-5 py-3">Name</TableHead>
                    <TableHead class="px-5 py-3">Type</TableHead>
                    <TableHead class="px-5 py-3">Category</TableHead>
                    <TableHead class="px-5 py-3">Cadence</TableHead>
                    <TableHead class="px-5 py-3">Avg Amount</TableHead>
                    <TableHead class="px-5 py-3">Occurrences</TableHead>
                    <TableHead class="px-5 py-3">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each financeView.recurringBankEntries as entry (entry.merchantKey)}
                    <TableRow class="hover:bg-[#1c2030]">
                      <TableCell class="px-5 py-3 text-slate-200">{entry.displayName}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400 capitalize">{entry.flow}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{entry.resolvedCategory}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400 capitalize">{entry.cadence}</TableCell>
                      <TableCell
                        class="px-5 py-3 font-semibold {entry.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
                      >
                        {fmtCurrency(entry.averageAmount, "USD")}
                      </TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{entry.occurrences}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{entry.lastSeenDate}</TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}
  </div>
</div>
