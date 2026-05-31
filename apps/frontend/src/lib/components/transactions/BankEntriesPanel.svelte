<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "$lib/components/ui/select";
  import { SlidersHorizontal, Pencil, Trash2, LoaderCircle, ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon } from "lucide-svelte";
  import CategorySelect from "$lib/components/CategorySelect.svelte";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Drawer from "$lib/components/ui/drawer";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Popover from "$lib/components/ui/popover";
  import { Calendar as CalendarPicker } from "$lib/components/ui/calendar";
  import { parseDate, type DateValue } from "@internationalized/date";
  import { httpPostManualTransaction, httpPatchTransaction, httpDeleteTransaction } from "$lib/requests/transactions";
  import type { FinanceCategory } from "@finance-app/shared-types";
  import { createTransactionRequest, get } from "$lib/stores/ui";
  import Pagination from "$lib/components/Pagination.svelte";
  import DeleteModal from "$lib/components/DeleteModal.svelte";

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
    subCategoryId?: string | null;
    subCategoryName?: string | null;
    isTransfer?: boolean;
    isInternal?: boolean;
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
    categoryId: string;
    subCategoryId: string;
    sortBy: string;
    sortDir: string;
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
    filters = { flow: "", search: "", minAmount: "", maxAmount: "", categoryId: "", subCategoryId: "", sortBy: "", sortDir: "" },
    onRefresh,
    onModeChange,
    onPageChange,
    onFilterChange,
    onSearchInput,
    onTransactionCreated,
    onTransactionUpdated,
    onTransactionDeleted,
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
    onTransactionCreated?: () => void;
    onTransactionUpdated?: (tx: TransactionItem) => void;
    onTransactionDeleted?: (transactionId: string) => void;
  } = $props();

  let isMobile = $state(false);
  onMount(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    isMobile = mq.matches;
    const fn = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  });

  let syncing = $state(false);

  async function handleRefresh() {
    syncing = true;
    try {
      await onRefresh();
    } finally {
      syncing = false;
    }
  }

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

  const activeFilterCount = $derived(
    [filters.flow, filters.search, filters.minAmount, filters.maxAmount, filters.categoryId, filters.subCategoryId].filter(Boolean).length,
  );
  const hasActiveFilters = $derived(activeFilterCount > 0);

  // ── Filter modal state ────────────────────────────────────────────────────
  let filterModalOpen = $state(false);
  let draftSearch = $state("");
  let draftFlow = $state("");
  let draftMinAmount = $state("");
  let draftMaxAmount = $state("");
  let draftCategoryId = $state("");
  let draftSubCategoryId = $state("");

  const draftSubCategoryOptions = $derived(categories.find((c) => c.id === draftCategoryId)?.subCategories ?? []);

  function openFilterModal() {
    draftSearch = filters.search;
    draftFlow = filters.flow;
    draftMinAmount = filters.minAmount;
    draftMaxAmount = filters.maxAmount;
    draftCategoryId = filters.categoryId;
    draftSubCategoryId = filters.subCategoryId;
    filterModalOpen = true;
  }

  function applyFilters() {
    onFilterChange?.({
      search: draftSearch,
      flow: draftFlow,
      minAmount: draftMinAmount,
      maxAmount: draftMaxAmount,
      categoryId: draftCategoryId,
      subCategoryId: draftSubCategoryId,
    });
    filterModalOpen = false;
  }

  function clearAndCloseFilters() {
    onFilterChange?.({ search: "", flow: "", minAmount: "", maxAmount: "", categoryId: "", subCategoryId: "" });
    filterModalOpen = false;
  }

  // ── Create manual transaction modal ──────────────────────────────────────
  let createModalOpen = $state(false);

  // Open modal when the layout's floating button fires a request
  let _seenRequest = get(createTransactionRequest);
  $effect(() => {
    const req = $createTransactionRequest;
    if (req !== _seenRequest) {
      _seenRequest = req;
      openCreateModal();
    }
  });

  let createName = $state("");
  let createDate = $state("");
  let createDateValue = $state<DateValue | undefined>(undefined);
  let datePickerOpen = $state(false);
  let createAmount = $state("");
  let createFlow = $state<"income" | "expense">("expense");
  let createCategoryId = $state("");
  let createSubCategoryId = $state("");
  let createSelectedValue = $state("");
  let createSaving = $state(false);

  const createFlowCategories = $derived(categories.filter((c) => c.type === createFlow));

  $effect(() => {
    if (createDateValue) {
      const newDate = `${createDateValue.year}-${String(createDateValue.month).padStart(2, "0")}-${String(createDateValue.day).padStart(2, "0")}`;
      if (newDate !== createDate) {
        createDate = newDate;
        datePickerOpen = false;
      }
    }
  });

  function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return "Pick a date";
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
  }

  function openCreateModal() {
    createName = "";
    const todayStr = new Date().toISOString().slice(0, 10);
    createDate = todayStr;
    createDateValue = parseDate(todayStr);
    datePickerOpen = false;
    createAmount = "";
    createFlow = "expense";
    createCategoryId = "";
    createSubCategoryId = "";
    createSelectedValue = "";
    createModalOpen = true;
  }

  function handleCreateCategorySelect(value: string) {
    createSelectedValue = value;
    if (!value) { createCategoryId = ""; createSubCategoryId = ""; return; }
    let foundParent: string | null = null;
    for (const cat of categories) {
      if (cat.subCategories.some((s) => s.id === value)) { foundParent = cat.id; break; }
    }
    if (foundParent) { createCategoryId = foundParent; createSubCategoryId = value; }
    else { createCategoryId = value; createSubCategoryId = ""; }
  }

  async function saveCreate() {
    const trimmedName = createName.trim();
    const parsedAmount = parseFloat(createAmount);
    if (!trimmedName || !createDate || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    createSaving = true;
    try {
      await httpPostManualTransaction({
        name: trimmedName,
        date: createDate,
        amount: parsedAmount,
        flow: createFlow,
        categoryId: createCategoryId || null,
        subCategoryId: createSubCategoryId || null,
      });
      createModalOpen = false;
      onTransactionCreated?.();
    } finally {
      createSaving = false;
    }
  }

  // ── Sorting ───────────────────────────────────────────────────────────────
  function handleSort(col: string) {
    if (filters.sortBy === col) {
      if (filters.sortDir === "desc") {
        onFilterChange?.({ sortBy: col, sortDir: "asc" });
      } else {
        onFilterChange?.({ sortBy: "", sortDir: "" });
      }
    } else {
      onFilterChange?.({ sortBy: col, sortDir: "desc" });
    }
  }

  // ── Edit / Delete modal state ─────────────────────────────────────────────
  let modalTx = $state<TransactionItem | null>(null);
  let modalMode = $state<"edit" | null>(null);
  let editCategoryId = $state("");
  let editSubCategoryId = $state("");
  let editFlow = $state<"income" | "expense">("expense");
  let editIsInternal = $state(false);
  let editSaving = $state(false);
  let applyToSimilar = $state(false);

  let deleteTx = $state<TransactionItem | null>(null);
  let deleteModalOpen = $state(false);
  let deleteLoading = $state(false);

  const editFlowCategories = $derived(categories.filter((c) => c.type === editFlow));

  let editSelectedValue = $state("");

  function handleCategorySelect(value: string) {
    editSelectedValue = value;
    if (!value) {
      editCategoryId = "";
      editSubCategoryId = "";
      return;
    }
    let foundParent: string | null = null;
    for (const cat of categories) {
      if (cat.subCategories.some((s) => s.id === value)) {
        foundParent = cat.id;
        break;
      }
    }
    if (foundParent) {
      editCategoryId = foundParent;
      editSubCategoryId = value;
    } else {
      editCategoryId = value;
      editSubCategoryId = "";
    }
  }

  function openEditModal(tx: TransactionItem) {
    modalTx = tx;
    modalMode = "edit";
    editCategoryId = tx.categoryId ?? tx.resolvedCategoryId ?? "";
    editSubCategoryId = tx.subCategoryId ?? "";
    editSelectedValue = tx.subCategoryId ?? tx.categoryId ?? tx.resolvedCategoryId ?? "";
    editFlow = tx.flow;
    editIsInternal = tx.isInternal ?? false;
    applyToSimilar = false;
  }

  function openDeleteModal(tx: TransactionItem) {
    deleteTx = tx;
    deleteModalOpen = true;
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
        subCategoryId: editSubCategoryId || null,
        flow: editFlow,
        isInternal: editIsInternal,
        applyToSimilar,
      });
      onTransactionUpdated?.(updated);
      closeModal();
    } finally {
      editSaving = false;
    }
  }

  async function confirmDelete() {
    if (!deleteTx) return;
    deleteLoading = true;
    try {
      await httpDeleteTransaction(deleteTx.transactionId);
      const id = deleteTx.transactionId;
      deleteTx = null;
      onTransactionDeleted?.(id);
    } finally {
      deleteLoading = false;
    }
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

      {#if mode === "transactions" && (hasSyncedData || serverTotal > 0)}
        <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" onclick={openFilterModal} class="md:hidden">
          <SlidersHorizontal class="h-3.5 w-3.5" />
          Filters{hasActiveFilters ? ` (${activeFilterCount})` : ""}
        </Button>
      {/if}

      <div class="hidden items-center gap-2 md:flex">
        <Button
          variant={mode === "transactions" ? "default" : "outline"}
          size="sm"
          onclick={() => switchMode("transactions")}>Transactions</Button
        >
        <Button variant={mode === "recurring" ? "default" : "outline"} size="sm" onclick={() => switchMode("recurring")}
          >Recurring</Button
        >
        {#if mode === "transactions"}
          <Button variant="outline" size="sm" onclick={openCreateModal}>+ Add</Button>
        {/if}
        {#if mode === "transactions" && (hasSyncedData || serverTotal > 0)}
          <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" onclick={openFilterModal}>
            <SlidersHorizontal class="mr-1.5 h-3.5 w-3.5" />
            Filters{hasActiveFilters ? ` (${activeFilterCount})` : ""}
          </Button>
        {/if}
        {#if connected}
          <Button variant="outline" size="sm" onclick={handleRefresh} disabled={syncing}>
            {#if syncing}
              <LoaderCircle class="animate-spin" />
              Syncing...
            {:else}
              Refresh
            {/if}
          </Button>
        {/if}
      </div>
    </div>

  </CardHeader>

  <CardContent class="p-0">
    {#if mode === "transactions"}
      {#if serverTotal === 0 && !connected}
        <p class="px-5 py-10 text-center text-sm text-slate-500">
          No bank connected. Use <strong>+ Add</strong> to log transactions manually.
        </p>
      {:else if serverTotal === 0 && !synced}
        <p class="px-5 py-10 text-center text-sm text-slate-500">Syncing bank data...</p>
      {:else if serverTotal === 0 && !hasSyncedData}
        <p class="px-5 py-10 text-center text-sm text-slate-500">No synced transactions yet. Click refresh.</p>
      {:else}
        <div class="space-y-4 px-3 pb-4 pt-3 md:px-5 md:pt-4">
          {#if transactions.length === 0}
            <p class="rounded-lg border border-[#252a3a] px-5 py-8 text-center text-sm text-slate-500">
              No transactions found.
            </p>
          {:else}
            <!-- Mobile cards -->
            <div class="space-y-2 md:hidden">
              {#each transactions as tx (tx.transactionId)}
                <article class="rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-3">
                  <!-- Row 1: name + amount -->
                  <div class="flex items-start justify-between gap-3">
                    <p class="min-w-0 truncate text-base font-medium text-slate-100">{tx.name}</p>
                    <p class="shrink-0 text-base font-semibold {tx.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                      {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                    </p>
                  </div>
                  <!-- Row 2: category + date + badges + actions -->
                  <div class="mt-2 flex items-center justify-between gap-2">
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <p class="truncate text-sm text-slate-400">
                        {tx.resolvedCategory}{tx.subCategoryName ? ` · ${tx.subCategoryName}` : ""}
                      </p>
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm text-slate-500">{tx.date}</span>
                        {#if tx.isInternal}
                          <span class="rounded-full bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400">Internal</span>
                        {/if}
                        {#if tx.isTransfer}
                          <span class="rounded-full bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-400">Transfer</span>
                        {/if}
                      </div>
                    </div>
                    <div class="flex shrink-0 gap-1">
                      <button
                        onclick={() => openEditModal(tx)}
                        class="rounded-lg p-2 text-blue-400 transition-colors hover:bg-blue-950/50 hover:text-blue-300"
                      >
                        <Pencil class="h-4 w-4" />
                      </button>
                      <button
                        onclick={() => openDeleteModal(tx)}
                        class="rounded-lg p-2 text-rose-500 transition-colors hover:bg-rose-950/50 hover:text-rose-400"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              {/each}
            </div>

            <!-- Desktop table -->
            <div class="hidden md:block">
              <Table class="table-fixed w-full">
                <TableHeader class="border-b border-[#252a3a] bg-[#1c2030]">
                  <TableRow class="border-none">
                    <TableHead class="w-[110px] px-3 py-3">
                      <button
                        class="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200"
                        onclick={() => handleSort("date")}
                      >
                        Date
                        {#if filters.sortBy === "date"}
                          {#if filters.sortDir === "asc"}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
                        {:else}
                          <ArrowUpDown class="h-3.5 w-3.5 opacity-40" />
                        {/if}
                      </button>
                    </TableHead>
                    <TableHead class="w-[25%] px-3 py-3">
                      <button
                        class="flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200"
                        onclick={() => handleSort("name")}
                      >
                        Name
                        {#if filters.sortBy === "name"}
                          {#if filters.sortDir === "asc"}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
                        {:else}
                          <ArrowUpDown class="h-3.5 w-3.5 opacity-40" />
                        {/if}
                      </button>
                    </TableHead>
                    <TableHead class="w-[20%] px-3 py-3">Merchant</TableHead>
                    <TableHead class="w-[20%] px-3 py-3">Category</TableHead>
                    <TableHead class="w-[120px] px-3 py-3 text-right">
                      <button
                        class="ml-auto flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200"
                        onclick={() => handleSort("amount")}
                      >
                        Amount
                        {#if filters.sortBy === "amount"}
                          {#if filters.sortDir === "asc"}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown class="h-3.5 w-3.5" />{/if}
                        {:else}
                          <ArrowUpDown class="h-3.5 w-3.5 opacity-40" />
                        {/if}
                      </button>
                    </TableHead>
                    <TableHead class="w-[76px] px-2 py-3"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each transactions as tx (tx.transactionId)}
                    <TableRow class="hover:bg-[#1c2030]">
                      <TableCell class="whitespace-nowrap px-3 py-3 text-slate-400">{tx.date}</TableCell>
                      <TableCell class="truncate px-3 py-3 text-slate-200" title={tx.name}>{tx.name}</TableCell>
                      <TableCell class="truncate px-3 py-3 text-slate-400" title={tx.merchantName ?? ""}
                        >{tx.merchantName ?? "-"}</TableCell
                      >
                      <TableCell class="px-3 py-3 text-slate-400">
                        <span class="flex items-center gap-1.5">
                          {tx.resolvedCategory}{tx.subCategoryName ? ` · ${tx.subCategoryName}` : ""}
                          {#if tx.isInternal}
                            <span class="rounded-full bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400"
                              >Internal</span
                            >
                          {/if}
                          {#if tx.isTransfer}
                            <span class="rounded-full bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-400"
                              >Transfer</span
                            >
                          {/if}
                        </span>
                      </TableCell>
                      <TableCell
                        class="whitespace-nowrap px-3 py-3 text-right font-semibold {tx.flow === 'income'
                          ? 'text-emerald-400'
                          : 'text-rose-400'}"
                      >
                        {tx.flow === "income" ? "+" : "-"}{fmtCurrency(Math.abs(tx.amount), tx.isoCurrencyCode)}
                      </TableCell>
                      <TableCell class="px-2 py-3">
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

        <Pagination
          currentPage={serverPage}
          totalPages={serverTotalPages}
          onchange={(p) => onPageChange?.(p)}
        />
      {/if}
    {:else if !connected}
      <p class="px-5 py-8 text-center text-sm text-slate-500">No bank connected yet.</p>
    {:else if !synced}
      <p class="px-5 py-8 text-center text-sm text-slate-500">Recurring detection starts after sync.</p>
    {:else if recurringEntries.length === 0}
      <p class="px-5 py-8 text-center text-sm text-slate-500">No recurring entries detected yet.</p>
    {:else}
      <div class="space-y-2 px-3 pb-3 pt-3 md:hidden">
        {#each pagedRecurringEntries as entry (entry.merchantKey)}
          <article class="rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 truncate text-base font-medium text-slate-100">{entry.displayName}</p>
              <p class="shrink-0 text-base font-semibold {entry.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                {fmtCurrency(entry.averageAmount, "USD")}
              </p>
            </div>
            <div class="mt-2 flex items-center justify-between gap-2">
              <div class="flex min-w-0 flex-col gap-0.5">
                <p class="truncate text-sm text-slate-400">{entry.resolvedCategory}</p>
                <div class="flex items-center gap-1.5">
                  <span class="text-sm text-slate-500 capitalize">{entry.cadence}</span>
                  <span class="text-sm text-slate-600">· {entry.occurrences}×</span>
                </div>
              </div>
              <p class="shrink-0 text-xs text-slate-500">{entry.lastSeenDate}</p>
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

      <Pagination
        currentPage={recurringPage}
        totalPages={recurringTotalPages}
        onchange={(p) => (recurringPage = p)}
      />
    {/if}
  </CardContent>
</Card>

<!-- ── Shared form snippets ─────────────────────────────────────────────── -->

{#snippet createFormBody()}
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Date</Label>
        <Popover.Root bind:open={datePickerOpen}>
          <Popover.Trigger class="flex h-9 w-full items-center rounded-md border border-[#252a3a] bg-[#1c2030] px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8dee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f14]">
            <CalendarIcon class="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <span class={!createDate ? "text-slate-500" : ""}>{formatDateDisplay(createDate)}</span>
          </Popover.Trigger>
          <Popover.Content align="start" class="w-auto p-0">
            <CalendarPicker type="single" bind:value={createDateValue} />
          </Popover.Content>
        </Popover.Root>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Type</Label>
        <Select class="h-9" bind:value={createFlow} onchange={() => { createCategoryId = ""; createSubCategoryId = ""; createSelectedValue = ""; }}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </Select>
      </div>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Description</Label>
      <Input class="h-9" placeholder="e.g. Coffee, Cash withdrawal…" bind:value={createName} />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Amount</Label>
      <Input class="h-9" type="number" min="0" step="0.01" placeholder="0.00" bind:value={createAmount} />
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Category</Label>
      <CategorySelect
        categories={createFlowCategories}
        bind:value={createSelectedValue}
        placeholder="No category"
        onchange={handleCreateCategorySelect}
        class="h-9"
      />
    </div>
  </div>
{/snippet}

{#snippet filterFormBody()}
  <div class="space-y-4">
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Search</Label>
      <Input class="h-9" placeholder="Name or merchant..." bind:value={draftSearch} />
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Type</Label>
        <Select class="h-9" bind:value={draftFlow}>
          <option value="">All</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </Select>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Category</Label>
        <Select class="h-9" bind:value={draftCategoryId} onchange={() => (draftSubCategoryId = "")}>
          <option value="">All</option>
          {#each categories as cat (cat.id)}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </Select>
      </div>
    </div>
    {#if draftSubCategoryOptions.length > 0}
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Sub-category</Label>
        <Select class="h-9" bind:value={draftSubCategoryId}>
          <option value="">All</option>
          {#each draftSubCategoryOptions as sub (sub.id)}
            <option value={sub.id}>{sub.name}</option>
          {/each}
        </Select>
      </div>
    {/if}
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Min amount ($)</Label>
        <Input class="h-9" type="number" min="0" placeholder="0" bind:value={draftMinAmount} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-sm text-slate-400">Max amount ($)</Label>
        <Input class="h-9" type="number" min="0" placeholder="No limit" bind:value={draftMaxAmount} />
      </div>
    </div>
  </div>
{/snippet}

{#snippet editFormBody()}
  <div class="space-y-4">
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Type</Label>
      <Select class="h-10" bind:value={editFlow} onchange={() => { editCategoryId = ""; editSubCategoryId = ""; editSelectedValue = ""; }}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </Select>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-sm text-slate-400">Category</Label>
      <CategorySelect
        categories={editFlowCategories}
        bind:value={editSelectedValue}
        placeholder="Auto-detect"
        onchange={handleCategorySelect}
        class="h-10"
      />
    </div>
    <div class="flex items-center gap-3">
      <Checkbox bind:checked={editIsInternal} class="size-5 md:size-4 shrink-0" />
      <span class="cursor-pointer text-sm text-slate-400 md:text-sm" onclick={() => (editIsInternal = !editIsInternal)}>
        Mark as internal (exclude from home page summary)
      </span>
    </div>
    <div class="flex items-center gap-3">
      <Checkbox bind:checked={applyToSimilar} class="size-5 md:size-4 shrink-0" />
      <span class="cursor-pointer text-sm text-slate-400" onclick={() => (applyToSimilar = !applyToSimilar)}>
        Apply to all transactions from the same merchant
      </span>
    </div>
  </div>
{/snippet}

<!-- ── Create Transaction ───────────────────────────────────────────────── -->
{#if isMobile}
  <Drawer.Root bind:open={createModalOpen}>
    <Drawer.Content>
      <Drawer.Header class="text-left">
        <Drawer.Title>Add Transaction</Drawer.Title>
        <Drawer.Description>Log a manual transaction not captured by your bank.</Drawer.Description>
      </Drawer.Header>
      <div class="overflow-y-auto px-4 pb-2">{@render createFormBody()}</div>
      <Drawer.Footer>
        <Button onclick={saveCreate} disabled={createSaving || !createName.trim() || !createDate || !createAmount}>
          {createSaving ? "Saving…" : "Add Transaction"}
        </Button>
        <Button variant="outline" onclick={() => (createModalOpen = false)}>Cancel</Button>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer.Root>
{:else}
  <Dialog.Root bind:open={createModalOpen}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Add Transaction</Dialog.Title>
        <Dialog.Description>Log a manual transaction not captured by your bank.</Dialog.Description>
      </Dialog.Header>
      <div class="py-2">{@render createFormBody()}</div>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (createModalOpen = false)}>Cancel</Button>
        <Button onclick={saveCreate} disabled={createSaving || !createName.trim() || !createDate || !createAmount}>
          {createSaving ? "Saving…" : "Add Transaction"}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- ── Filter ──────────────────────────────────────────────────────────── -->
{#if isMobile}
  <Drawer.Root bind:open={filterModalOpen}>
    <Drawer.Content>
      <Drawer.Header class="text-left">
        <Drawer.Title>Filter Transactions</Drawer.Title>
        <Drawer.Description>Narrow down by type, category, or amount.</Drawer.Description>
      </Drawer.Header>
      <div class="overflow-y-auto px-4 pb-2">{@render filterFormBody()}</div>
      <Drawer.Footer>
        <Button onclick={applyFilters}>Apply</Button>
        {#if hasActiveFilters}
          <Button variant="ghost" class="text-slate-400" onclick={clearAndCloseFilters}>Clear all</Button>
        {/if}
        <Button variant="outline" onclick={() => (filterModalOpen = false)}>Cancel</Button>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer.Root>
{:else}
  <Dialog.Root bind:open={filterModalOpen}>
    <Dialog.Content class="sm:max-w-md">
      <Dialog.Header>
        <Dialog.Title>Filter Transactions</Dialog.Title>
        <Dialog.Description>Narrow down transactions by type, category, or amount.</Dialog.Description>
      </Dialog.Header>
      <div class="py-2">{@render filterFormBody()}</div>
      <Dialog.Footer class="gap-2 sm:gap-0">
        {#if hasActiveFilters}
          <Button variant="ghost" class="mr-auto text-slate-400" onclick={clearAndCloseFilters}>Clear all</Button>
        {/if}
        <Button variant="outline" onclick={() => (filterModalOpen = false)}>Cancel</Button>
        <Button onclick={applyFilters}>Apply</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- ── Edit Transaction ────────────────────────────────────────────────── -->
{#if isMobile}
  <Drawer.Root open={modalMode === "edit" && modalTx !== null} onOpenChange={(v) => { if (!v) closeModal(); }}>
    <Drawer.Content>
      <Drawer.Header class="text-left">
        <Drawer.Title>Edit Transaction</Drawer.Title>
        <Drawer.Description class="truncate">{modalTx?.name ?? ""}</Drawer.Description>
      </Drawer.Header>
      <div class="overflow-y-auto px-4 pb-2">{@render editFormBody()}</div>
      <Drawer.Footer>
        <Button onclick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
        <Button variant="outline" onclick={closeModal}>Cancel</Button>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer.Root>
{:else}
  <Dialog.Root open={modalMode === "edit" && modalTx !== null} onOpenChange={(v) => { if (!v) closeModal(); }}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Edit Transaction</Dialog.Title>
        <Dialog.Description class="truncate">{modalTx?.name ?? ""}</Dialog.Description>
      </Dialog.Header>
      <div class="py-2">{@render editFormBody()}</div>
      <Dialog.Footer>
        <Button variant="outline" onclick={closeModal}>Cancel</Button>
        <Button onclick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- ── Delete Transaction ──────────────────────────────────────────────── -->
<DeleteModal
  bind:open={deleteModalOpen}
  title="Delete transaction"
  description={deleteTx ? `"${deleteTx.name}" will be permanently removed.` : undefined}
  onconfirm={confirmDelete}
  loading={deleteLoading}
/>
