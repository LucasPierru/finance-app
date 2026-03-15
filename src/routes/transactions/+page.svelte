<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { Select } from "$lib/components/ui/select";
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui/table";
  import { apiRequest } from "$lib/api/client";
  import type { FinanceItem } from "$lib/stores/finance";
  import type { BankConnectionState } from "$lib/types/banking";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  type Transaction = FinanceItem & { kind: "income" | "expense" };
  type MonthlyTransactionGroup = {
    key: string;
    label: string;
    items: ReturnType<typeof getEffectiveFinanceView>["categorizedBankTransactions"];
  };

  let selectedMonthKey = $state("all");
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

  const transactions = $derived<Transaction[]>(
    [
      ...financeView.revenues.map((item) => ({ ...item, kind: "income" as const })),
      ...financeView.costs.map((item) => ({ ...item, kind: "expense" as const })),
    ].sort((a, b) => b.amount - a.amount),
  );

  function groupTransactionsByMonth() {
    const groups = new Map<string, MonthlyTransactionGroup>();

    for (const transaction of financeView.categorizedBankTransactions) {
      const parsedDate = new Date(transaction.date);
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
    { value: "all", label: "All months" },
    ...syncedTransactionsByMonth.map((group) => ({ value: group.key, label: group.label })),
  ]);

  const filteredMonthGroups = $derived(
    selectedMonthKey === "all"
      ? syncedTransactionsByMonth
      : syncedTransactionsByMonth.filter((group) => group.key === selectedMonthKey),
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

  $effect(() => {
    if (selectedMonthKey === "all") return;
    const exists = syncedTransactionsByMonth.some((group) => group.key === selectedMonthKey);
    if (!exists) {
      selectedMonthKey = "all";
    }
  });
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Transactions" subtitle="Unified view of recurring income and expenses" />

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Total Income</CardDescription>
          <CardTitle class="text-2xl text-emerald-400">{fmt(financeView.totalRevenue)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Total Expenses</CardDescription>
          <CardTitle class="text-2xl text-rose-400">{fmt(financeView.totalCosts)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Net Monthly</CardDescription>
          <CardTitle class="text-2xl {financeView.monthlySurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {fmt(financeView.monthlySurplus)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>

    {#if !bankIsSynced}
      <Card>
        <CardHeader>
          <CardTitle>Recurring Entries</CardTitle>
          <CardDescription>Sorted by highest monthly impact first.</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          {#if transactions.length === 0}
            <p class="px-5 py-10 text-sm text-center text-slate-500">
              No entries yet. Add income or expenses to populate this list.
            </p>
          {:else}
            <div class="overflow-x-auto">
              <Table class="min-w-[680px]">
                <TableHeader class="border-y border-[#252a3a] bg-[#1c2030]">
                  <TableRow class="border-none">
                    <TableHead class="px-5 py-3">Type</TableHead>
                    <TableHead class="px-5 py-3">Name</TableHead>
                    <TableHead class="px-5 py-3">Category</TableHead>
                    <TableHead class="px-5 py-3">Raw Amount</TableHead>
                    <TableHead class="px-5 py-3">Frequency</TableHead>
                    <TableHead class="px-5 py-3">Monthly Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each transactions as tx (tx.id)}
                    <TableRow class="hover:bg-[#1c2030]">
                      <TableCell class="px-5 py-3">
                        <span
                          class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium
                        {tx.kind === 'income'
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : 'border-rose-500/40 text-rose-400 bg-rose-500/10'}"
                        >
                          {tx.kind}
                        </span>
                      </TableCell>
                      <TableCell class="px-5 py-3 text-slate-200">{tx.name}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.category}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">${tx.rawAmount}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400 capitalize">{tx.frequency}</TableCell>
                      <TableCell
                        class="px-5 py-3 font-semibold {tx.kind === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
                      >
                        {fmt(tx.amount)}
                      </TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            </div>
          {/if}
        </CardContent>
      </Card>
    {:else}
      <Card class="mt-5">
        <CardHeader>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Synced Bank Transactions</CardTitle>
              <CardDescription>
                Real transactions from Plaid connection.
                {#if !bankState.connected}
                  Connect in Settings to enable this section.{/if}
                {#if bankState.connected && !bankIsSynced}
                  Sync in progress...{/if}
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
            <div class="space-y-4 px-5 py-4">
              <div class="flex items-center gap-3">
                <p class="text-sm text-slate-400">Month</p>
                <Select class="w-full max-w-xs" value={selectedMonthKey} onchange={handleMonthFilterChange}>
                  {#each monthFilterOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </Select>
              </div>

              {#each filteredMonthGroups as monthGroup (monthGroup.key)}
                <div class="rounded-md border border-[#252a3a] overflow-hidden">
                  <div class="bg-[#1c2030] border-b border-[#252a3a] px-4 py-2.5">
                    <p class="text-sm font-semibold text-slate-300">{monthGroup.label}</p>
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
                        {#each monthGroup.items as tx (tx.transactionId)}
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
                      </TableBody>
                    </Table>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </CardContent>
      </Card>

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
