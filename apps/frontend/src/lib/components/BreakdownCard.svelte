<svelte:options runes={true} />

<script lang="ts">
  import type { FinanceItem } from "$lib/stores/finance";

  type Variant = "income" | "expense";

  let { variant, items }: { variant: Variant; items: FinanceItem[] } = $props();

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  const copyByVariant: Record<Variant, { title: string; dotClass: string; emptyMessage: string; amountClass: string }> =
    {
      income: {
        title: "Income Sources",
        dotClass: "bg-emerald-400",
        emptyMessage: "No income added yet",
        amountClass: "text-emerald-400",
      },
      expense: {
        title: "Expenses",
        dotClass: "bg-rose-400",
        emptyMessage: "No expenses added yet",
        amountClass: "text-rose-400",
      },
    };

  const copy = $derived(copyByVariant[variant]);
</script>

<div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-5">
  <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
    <span class="w-2 h-2 rounded-full {copy.dotClass}"></span>{copy.title}
  </h3>
  {#if items.length === 0}
    <p class="text-slate-600 text-sm py-4 text-center">{copy.emptyMessage}</p>
  {:else}
    {#each items as item}
      <div class="flex justify-between items-center py-2.5 border-b border-[#1c2030] last:border-none">
        <div class="flex flex-col">
          <span class="text-sm text-slate-300">{item.name}</span>
          <span class="text-xs text-slate-500">{item.category}</span>
        </div>
        <span class="text-sm font-semibold {copy.amountClass}">{fmt(item.amount)}/mo</span>
      </div>
    {/each}
  {/if}
</div>
