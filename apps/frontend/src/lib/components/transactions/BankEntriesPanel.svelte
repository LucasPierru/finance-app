<svelte:options runes={true} />

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "$lib/components/ui/select";
  import { SlidersHorizontal, Pencil, Trash2 } from "lucide-svelte";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { httpPatchTransaction, httpDeleteTransaction } from "$lib/requests/transactions";
  import type { FinanceCategory } from "@finance-app/shared-types";

  type Mode = "transactions" | "recurring";

  interface TransactionItem {
    transactionId: string;
    date: string;
    name: string;
    merchantName: string | null;
    resolvedCategory: string;
    resolvedCategoryId: string | null;
    pending: boolean;
    flow: "income" | "expense";
    amount: number;
    isoCurrencyCode: string | null;
    categoryId: string | null;
    isTransfer?: boolean;
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

  interface ActiveFilters {
    flow: string;
    search: string;
    minAmount: string;
    maxAmount: string;
  }

  let {
    connected,
    synced,
    hasSyncedData,
    mode,
    selectedMonthLabel,
    transactions,
    recurringEntries,
    categories = [],
    serverPage = 1,
    serverTotalPages = 1,
    serverTotal = 0,
    filters = { flow: "", search: "", minAmount: "", maxAmount: "" },
    onRefresh,
    onModeChange,
    onPageChange,
    onFilterChange,
    onSearchInput,
    onTransactionUpdated,
  }: {
    connected: boolean;
    synced: boolean;
    hasSyncedData: boolean;
    mode: Mode;
    selectedMonthLabel: string;
    transactions: TransactionItem[];
    recurringEntries: RecurringEntry[];
    categories?: FinanceCategory[];
    serverPage?: number;
    serverTotalPages?: number;
    serverTotal?: number;
    filters?: ActiveFilters;
    onRefresh: () => Promise<void> | void;
    onModeChange: (value: Mode) => void;
    onPageChange?: (page: number) => void;
    onFilterChange?: (patch: Record<string, string>) => void;
    onSearchInput?: (value: string) => void;
    onTransactionUpdated?: (tx: TransactionItem) => void;
    onTransactionDeleted?: (transactionId: string) => void;
  } = $props();

  // Client-side pagination only used for recurring entries
  let recurringPage = $state(1);
  const recurringPageSize = 12;
  const recurringTotalPages = $derived(Math.max(1, Math.ceil(recurringEntries.length / recurringPageSize)));
  const pagedRecurringEntries = $derived.by(() => {
    const start = (recurringPage - 1) * recurringPageSize;
    return recurringEntries.slice(start, start + recurringPageSize);
  });

  $effect(() => {
    if (recurringPage > recurringTotalPages) recurringPage = 1;
  });

  function fmtCurrency(amount: number, currencyCode: string | null): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function switchMode(next: Mode) {
    onModeChange(next);
    recurringPage = 1;
  }

  const hasActiveFilters = $derived(
    filters.flow !== "" || filters.search !== "" || filters.minAmount !== "" || filters.maxAmount !== "",
  );

  let showFilters = $state(false);

  // ── Modal state ────────────────────────────────────────────────────────────
  let modalTx = $state<TransactionItem | null>(null);
  let modalMode = $state<"edit" | "delete" | null>(null);
  let editCategoryId = $state("");
  let editFlow = $state<"income" | "expense">("expense");
  let editSaving = $state(false);
  let applyToSimilar = $state(false);
  let deleteDeleting = $state(false);

  const editableCategories = $derived(categories.filter((c) => c.type === editFlow));

  function openEditModal(tx: TransactionItem) {
    modalTx = tx;
    modalMode = "edit";
    editCategoryId = tx.categoryId ?? tx.resolvedCategoryId ?? "";
    editFlow = tx.flow;
    applyToSimilar = false;
  }

  function openDeleteModal(tx: TransactionItem) {
    modalTx = tx;
    modalMode = "delete";
  }

  function closeModal() {
    modalTx = null;
    modalMode = null;
  }

  async function saveEdit() {
    if (!modalTx) return;
    editSaving = true;
    try {
      const updated = await httpPatchTransaction<TransactionItem>(modalTx.transactionId, {
        categoryId: editCategoryId || null,
        flow: editFlow,
        applyToSimilar,
      });
      onTransactionUpdated?.(updated);
      closeModal();
    } finally {
      editSaving = false;
    }
  }

  async function confirmDelete() {
    if (!modalTx) return;
    deleteDeleting = true;
    try {
      await httpDeleteTransaction(modalTx.transactionId);
      const id = modalTx.transactionId;
      closeModal();
      onTransactionDeleted?.(id);
    } finally {
      deleteDeleting = false;
    }
  }

  function clearFilters() {
    onFilterChange?.({ flow: "", search: "", minAmount: "", maxAmount: "" });
    onSearchInput?.("");
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
              {serverTotal} transaction{serverTotal === 1 ? "" : "s"} found.
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
        {#if connected && mode === "transactions" && hasSyncedData}
          <Button variant={showFilters ? "default" : "outline"} size="sm" onclick={() => (showFilters = !showFilters)}>
            <SlidersHorizontal class="mr-1.5 h-3.5 w-3.5" />
            Filters{hasActiveFilters
              ? ` (${[filters.flow, filters.search, filters.minAmount, filters.maxAmount].filter(Boolean).length})`
              : ""}
          </Button>
        {/if}
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
        <!-- Filter bar -->
        {#if showFilters}
          <div class="flex flex-wrap items-end gap-3 border-b border-[#252a3a] px-5 py-4">
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <Label class="text-xs text-slate-500">Search</Label>
              <Input
                class="h-8 text-sm"
                placeholder="Name or merchant..."
                value={filters.search}
                oninput={(e) => onSearchInput?.((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-slate-500">Flow</Label>
              <Select
                class="h-8 w-28"
                value={filters.flow}
                onchange={(e) => onFilterChange?.({ flow: (e.target as HTMLSelectElement).value })}
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-slate-500">Min $</Label>
              <Input
                class="h-8 w-24 text-sm"
                type="number"
                min="0"
                placeholder="0"
                value={filters.minAmount}
                onchange={(e) => onFilterChange?.({ minAmount: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-slate-500">Max $</Label>
              <Input
                class="h-8 w-24 text-sm"
                type="number"
                min="0"
                placeholder="∞"
                value={filters.maxAmount}
                onchange={(e) => onFilterChange?.({ maxAmount: (e.target as HTMLInputElement).value })}
              />
            </div>
            {#if hasActiveFilters}
              <Button variant="ghost" size="sm" class="h-8 text-xs text-slate-400" onclick={clearFilters}>
                Clear filters
              </Button>
            {/if}
          </div>
        {/if}

        <div class="space-y-4 px-5 pb-4 pt-4">
          {#if transactions.length === 0}
            <p class="rounded-lg border border-[#252a3a] px-5 py-8 text-center text-sm text-slate-500">
              No transactions found.
            </p>
          {:else}
            <div class="space-y-3 md:hidden">
              {#each transactions as tx (tx.transactionId)}
                <article class="rounded-lg border border-[#252a3a] bg-[#13161e] p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-slate-200">{tx.name}</p>
                      <p class="text-xs text-slate-500">{tx.merchantName ?? "-"}</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      {#if tx.isTransfer}
                        <span class="rounded-full bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-400">Transfer</span>
                      {/if}
                      <p class="text-sm font-semibold {tx.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                        {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                      </p>
                    </div>
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <p class="text-slate-500">Date</p>
                    <p class="text-right text-slate-300">{tx.date}</p>
                    <p class="text-slate-500">Category</p>
                    <p class="text-right text-slate-300">
                      {tx.resolvedCategory}
                      {#if tx.categoryId}
                        <span class="ml-1 text-slate-500">(edited)</span>
                      {/if}
                    </p>
                    <p class="text-slate-500">Pending</p>
                    <p class="text-right text-slate-300">{tx.pending ? "Yes" : "No"}</p>
                  </div>
                  <div class="mt-3 flex gap-2 border-t border-[#252a3a] pt-3">
                    <button
                      onclick={() => openEditModal(tx)}
                      class="flex flex-1 items-center justify-center gap-2 rounded border border-[#252a3a] py-2 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
                    >
                      <Pencil class="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onclick={() => openDeleteModal(tx)}
                      class="flex items-center justify-center gap-2 rounded border border-[#252a3a] px-4 py-2 text-sm text-slate-400 transition-colors hover:border-rose-800 hover:text-rose-400"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
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
                    <TableHead class="px-5 py-3"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each transactions as tx (tx.transactionId)}
                    <TableRow class="hover:bg-[#1c2030]">
                      <TableCell class="whitespace-nowrap px-5 py-3 text-slate-400">{tx.date}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-200">{tx.name}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.merchantName ?? "-"}</TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">
                        <span>
                          {tx.resolvedCategory}
                          {#if tx.categoryId}
                            <span class="ml-1 text-xs text-slate-600">(edited)</span>
                          {/if}
                          {#if tx.isTransfer}
                            <span class="ml-1 rounded-full bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-400"
                              >Transfer</span
                            >
                          {/if}
                        </span>
                      </TableCell>
                      <TableCell class="px-5 py-3 text-slate-400">{tx.pending ? "Yes" : "No"}</TableCell>
                      <TableCell
                        class="px-5 py-3 font-semibold {tx.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}"
                      >
                        {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                      </TableCell>
                      <TableCell class="px-5 py-3">
                        <div class="flex items-center gap-0.5">
                          <button
                            onclick={() => openEditModal(tx)}
                            class="rounded p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                            title="Edit"
                          >
                            <Pencil class="h-4 w-4" />
                          </button>
                          <button
                            onclick={() => openDeleteModal(tx)}
                            class="rounded p-2 text-slate-500 transition-colors hover:bg-rose-900/40 hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 class="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            </div>
          {/if}
        </div>

        {#if serverTotalPages > 1}
          <div class="flex items-center justify-between border-t border-[#252a3a] px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              onclick={() => onPageChange?.(serverPage - 1)}
              disabled={serverPage <= 1}>Previous</Button
            >
            <p class="text-xs text-slate-500">Page {serverPage} / {serverTotalPages}</p>
            <Button
              variant="outline"
              size="sm"
              onclick={() => onPageChange?.(serverPage + 1)}
              disabled={serverPage >= serverTotalPages}>Next</Button
            >
          </div>
        {/if}
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

      {#if recurringTotalPages > 1}
        <div class="flex items-center justify-between border-t border-[#252a3a] px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            onclick={() => (recurringPage = Math.max(1, recurringPage - 1))}
            disabled={recurringPage <= 1}>Previous</Button
          >
          <p class="text-xs text-slate-500">Page {recurringPage} / {recurringTotalPages}</p>
          <Button
            variant="outline"
            size="sm"
            onclick={() => (recurringPage = Math.min(recurringTotalPages, recurringPage + 1))}
            disabled={recurringPage >= recurringTotalPages}>Next</Button
          >
        </div>
      {/if}
    {/if}
  </CardContent>
</Card>

<!-- Edit Dialog -->
<Dialog.Root
  open={modalMode === "edit" && modalTx !== null}
  onOpenChange={(v) => {
    if (!v) closeModal();
  }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit Transaction</Dialog.Title>
      <Dialog.Description class="truncate">{modalTx?.name ?? ""}</Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-2">
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Type</Label>
        <Select bind:value={editFlow} class="h-10">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </Select>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Category</Label>
        <Select bind:value={editCategoryId} class="h-10">
          <option value="">Auto-detect</option>
          {#each editableCategories as cat (cat.id)}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </Select>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" bind:checked={applyToSimilar} class="rounded" />
        Apply to all transactions from the same merchant
      </label>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={closeModal}>Cancel</Button>
      <Button onclick={saveEdit} disabled={editSaving}>
        {editSaving ? "Saving…" : "Save changes"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Dialog -->
<Dialog.Root
  open={modalMode === "delete" && modalTx !== null}
  onOpenChange={(v) => {
    if (!v) closeModal();
  }}
>
  <Dialog.Content>
    <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-900/40">
      <Trash2 class="h-5 w-5 text-rose-400" />
    </div>
    <Dialog.Header>
      <Dialog.Title>Delete Transaction</Dialog.Title>
      <Dialog.Description>Are you sure you want to delete this transaction?</Dialog.Description>
    </Dialog.Header>
    <p class="my-2 truncate font-medium text-slate-200">{modalTx?.name ?? ""}</p>
    <p class="text-xs text-slate-500">This action cannot be undone.</p>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={closeModal}>Cancel</Button>
      <Button class="bg-rose-600 text-white hover:bg-rose-700" onclick={confirmDelete} disabled={deleteDeleting}>
        {deleteDeleting ? "Deleting…" : "Delete"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
