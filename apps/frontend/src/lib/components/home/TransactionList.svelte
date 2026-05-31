<svelte:options runes={true} />

<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import Pagination from "$lib/components/Pagination.svelte";
  import { formatCurrency } from "$lib/utils/format";

  export interface DisplayTransaction {
    id: string;
    dateLabel: string;
    name: string;
    merchant: string;
    category: string;
    amount: number;
    flow: "income" | "expense";
    source: "bank" | "manual";
  }

  let {
    title,
    subtitle,
    items,
    pageSize = 10,
    hidePager = false,
    serverPage,
    serverTotalPages,
    onPageChange,
  }: {
    title: string;
    subtitle: string;
    items: DisplayTransaction[];
    pageSize?: number;
    hidePager?: boolean;
    serverPage?: number;
    serverTotalPages?: number;
    onPageChange?: (page: number) => void;
  } = $props();

  let page = $state(1);

  const isServerPaged = $derived(serverPage !== undefined && onPageChange !== undefined);
  const totalPages = $derived(
    isServerPaged ? (serverTotalPages ?? 1) : Math.max(1, Math.ceil(items.length / pageSize)),
  );
  const activePage = $derived(isServerPaged ? (serverPage ?? 1) : page);

  const pagedItems = $derived.by(() => {
    if (isServerPaged) return items;
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  });

  $effect(() => {
    items;
    if (!isServerPaged && page > totalPages) {
      page = 1;
    }
  });


</script>

<Card>
  <CardHeader>
    <CardTitle class="font-display text-xl">{title}</CardTitle>
    <CardDescription>{subtitle}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-2">
    {#if pagedItems.length === 0}
      <div class="rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-10 text-center text-sm text-slate-500">
        No transactions for this period.
      </div>
    {:else}
      {#each pagedItems as tx (tx.id)}
        <article class="rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <p class="min-w-0 truncate text-base font-medium text-slate-100">{tx.name}</p>
            <p class="shrink-0 text-base font-semibold {tx.flow === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
              {tx.flow === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
            </p>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="flex min-w-0 flex-col gap-0.5">
              <p class="truncate text-sm text-slate-400">{tx.category}</p>
              <div class="flex items-center gap-1.5">
                <span class="text-sm text-slate-500">{tx.dateLabel}</span>
                {#if tx.merchant}
                  <span class="text-sm text-slate-600">· {tx.merchant}</span>
                {/if}
                {#if tx.source === "manual"}
                  <span class="rounded-full bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400">Manual</span>
                {/if}
              </div>
            </div>
          </div>
        </article>
      {/each}
    {/if}

    {#if !hidePager}
      <Pagination
        currentPage={activePage}
        {totalPages}
        onchange={isServerPaged ? onPageChange : (p) => (page = p)}
        class="border-0 px-0 pt-2"
      />
    {/if}
  </CardContent>
</Card>
