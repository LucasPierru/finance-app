<svelte:options runes={true} />

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";

  type Mode = "transactions" | "recurring";

  interface MonthOption {
    value: string;
    label: string;
  }

  interface TransactionItem {
    transactionId: string;
    date: string;
    name: string;
    merchantName: string | null;
    resolvedCategory: string;
    pending: boolean;
    flow: "income" | "expense";
    amount: number;
    isoCurrencyCode: string | null;
  }

  interface RecurringEntry {
    merchantKey: string;
    displayName: string;
    flow: "income" | "expense";
    resolvedCategory: string;
    cadence: string;
    averageAmount: number;
    occurrences: number;
    lastSeenDate: string;
  }

  let {
    connected,
    synced,
    hasSyncedData,
    mode,
    selectedMonthLabel,
    transactions,
    recurringEntries,
    onRefresh,
    onModeChange,
  }: {
    connected: boolean;
    synced: boolean;
    hasSyncedData: boolean;
    mode: Mode;
    selectedMonthLabel: string;
    transactions: TransactionItem[];
    recurringEntries: RecurringEntry[];
    onRefresh: () => Promise<void> | void;
    onModeChange: (value: Mode) => void;
  } = $props();
  let page = $state(1);

  const pageSize = 12;

  const totalPages = $derived.by(() => {
    const totalItems = mode === "transactions" ? transactions.length : recurringEntries.length;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  });

  const pagedTransactions = $derived.by(() => {
    const start = (page - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  });

  const pagedRecurringEntries = $derived.by(() => {
    const start = (page - 1) * pageSize;
    return recurringEntries.slice(start, start + pageSize);
  });

  const canShowPagination = $derived.by(() => {
    if (mode === "transactions") {
      return connected && synced && hasSyncedData && transactions.length > pageSize;
    }
    return connected && synced && recurringEntries.length > pageSize;
  });

  $effect(() => {
    mode;
    transactions.length;
    recurringEntries.length;

    if (page > totalPages) {
      page = 1;
    }
  });

  function fmtCurrency(amount: number, currencyCode: string | null): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function nextPage() {
    if (page < totalPages) page += 1;
  }

  function previousPage() {
    if (page > 1) page -= 1;
  }

  function switchMode(next: Mode) {
    onModeChange(next);
    page = 1;
  }
</script>

<Card class="mt-5">
  <CardHeader>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <CardTitle>{mode === "transactions" ? "Synced Transactions" : "Detected Recurring Entries"}</CardTitle>
        <CardDescription>
          {#if mode === "transactions"}
            {#if !connected}
              Connect a bank account in Settings to unlock month-by-month transaction history.
            {:else}
              Browsing {selectedMonthLabel} transactions.
            {/if}
          {:else}
            Likely weekly/biweekly/monthly/quarterly patterns from synced transactions.
          {/if}
        </CardDescription>
      </div>

      <div class="hidden items-center gap-2 md:flex">
        <Button
          variant={mode === "transactions" ? "default" : "outline"}
          size="sm"
          onclick={() => switchMode("transactions")}>Transactions</Button
        >
        <Button variant={mode === "recurring" ? "default" : "outline"} size="sm" onclick={() => switchMode("recurring")}
          >Recurring</Button
        >
        {#if connected}
          <Button variant="outline" size="sm" onclick={onRefresh}>Refresh</Button>
        {/if}
      </div>
    </div>
  </CardHeader>

  <CardContent class="p-0">
    {#if mode === "transactions"}
      {#if !connected}
        <p class="px-5 py-10 text-center text-sm text-slate-500">No bank connected yet.</p>
      {:else if !synced}
        <p class="px-5 py-10 text-center text-sm text-slate-500">Syncing bank data...</p>
      {:else if !hasSyncedData}
        <p class="px-5 py-10 text-center text-sm text-slate-500">No synced transactions yet. Click refresh.</p>
      {:else}
        <div class="space-y-4 px-5 pb-4">
          {#if transactions.length === 0}
            <p class="rounded-lg border border-[#252a3a] px-5 py-8 text-center text-sm text-slate-500">
              No transactions for this month.
            </p>
          {:else}
            <div class="space-y-3 md:hidden">
              {#each pagedTransactions as tx (tx.transactionId)}
                <article class="rounded-lg border border-[#252a3a] bg-[#13161e] p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-slate-200">{tx.name}</p>
                      <p class="text-xs text-slate-500">{tx.merchantName ?? "-"}</p>
                    </div>
                    <p
                      class="shrink-0 text-sm font-semibold {tx.flow === 'income'
                        ? 'text-emerald-400'
                        : 'text-rose-400'}"
                    >
                      {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                    </p>
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <p class="text-slate-500">Date</p>
                    <p class="text-right text-slate-300">{tx.date}</p>
                    <p class="text-slate-500">Category</p>
                    <p class="text-right text-slate-300">{tx.resolvedCategory}</p>
                    <p class="text-slate-500">Pending</p>
                    <p class="text-right text-slate-300">{tx.pending ? "Yes" : "No"}</p>
                  </div>
                </article>
              {/each}
            </div>

            <div class="hidden overflow-x-auto md:block">
              <Table>
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
                  {#each pagedTransactions as tx (tx.transactionId)}
                    <TableRow class="hover:bg-[#1c2030]">
                      <TableCell class="px-5 py-3 text-slate-400">{tx.date}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-200">{tx.name}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.merchantName ?? "-"}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.resolvedCategory}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.pending ? "Yes" : "No"}</TableCell>
                      <TableCell
                        class="px-5 py-3 font-semibold {tx.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
                      >
                        {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                      </TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            </div>
          {/if}
        </div>
      {/if}
    {:else if !connected}
      <p class="px-5 py-8 text-center text-sm text-slate-500">No bank connected yet.</p>
    {:else if !synced}
      <p class="px-5 py-8 text-center text-sm text-slate-500">Recurring detection starts after sync.</p>
    {:else if recurringEntries.length === 0}
      <p class="px-5 py-8 text-center text-sm text-slate-500">No recurring entries detected yet.</p>
    {:else}
      <div class="space-y-3 p-3 md:hidden">
        {#each pagedRecurringEntries as entry (entry.merchantKey)}
          <article class="rounded-lg border border-[#252a3a] bg-[#13161e] p-3">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 truncate text-sm font-semibold text-slate-200">{entry.displayName}</p>
              <p
                class="shrink-0 text-sm font-semibold {entry.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
              >
                {fmtCurrency(entry.averageAmount, "USD")}
              </p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <p class="text-slate-500">Type</p>
              <p class="text-right capitalize text-slate-300">{entry.flow}</p>
              <p class="text-slate-500">Category</p>
              <p class="text-right text-slate-300">{entry.resolvedCategory}</p>
              <p class="text-slate-500">Cadence</p>
              <p class="text-right capitalize text-slate-300">{entry.cadence}</p>
              <p class="text-slate-500">Occurrences</p>
              <p class="text-right text-slate-300">{entry.occurrences}</p>
              <p class="text-slate-500">Last Seen</p>
              <p class="text-right text-slate-300">{entry.lastSeenDate}</p>
            </div>
          </article>
        {/each}
      </div>

      <div class="hidden overflow-x-auto md:block">
        <Table>
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
            {#each pagedRecurringEntries as entry (entry.merchantKey)}
              <TableRow class="hover:bg-[#1c2030]">
                <TableCell class="px-5 py-3 text-slate-200">{entry.displayName}</TableCell>
                <TableCell class="px-5 py-3 capitalize text-slate-400">{entry.flow}</TableCell>
                <TableCell class="px-5 py-3 text-slate-400">{entry.resolvedCategory}</TableCell>
                <TableCell class="px-5 py-3 capitalize text-slate-400">{entry.cadence}</TableCell>
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

    {#if canShowPagination}
      <div class="flex items-center justify-between border-t border-[#252a3a] px-5 py-3">
        <Button variant="outline" size="sm" onclick={previousPage} disabled={page <= 1}>Previous</Button>
        <p class="text-xs text-slate-500">Page {page} / {totalPages}</p>
        <Button variant="outline" size="sm" onclick={nextPage} disabled={page >= totalPages}>Next</Button>
      </div>
    {/if}
  </CardContent>
</Card>
