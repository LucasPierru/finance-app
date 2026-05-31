<svelte:options runes={true} />

<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import type { CostItem, Period } from "$lib/utils/budget";
  import type { BudgetPlan } from "@finance-app/shared-types";
  import { toMonthly, spentForItem } from "$lib/utils/budget";
  import { formatCurrency } from "$lib/utils/format";

  let {
    selectedPlan,
    costs,
  }: {
    selectedPlan: BudgetPlan | null;
    costs: CostItem[];
  } = $props();

  const rows = $derived.by(() => {
    if (!selectedPlan) return [];
    return selectedPlan.items
      .filter((i) => (i.flow ?? "expense") === "expense")
      .map((i) => {
        const budget = toMonthly(i.amount, i.period as Period);
        const spent = spentForItem(i, costs);
        const pct = budget > 0 ? (spent / budget) * 100 : 0;
        return {
          label: i.subCategoryName ?? i.categoryName ?? "General",
          budget,
          spent,
          pct,
          over: spent > budget,
        };
      })
      .sort((a, b) => b.budget - a.budget);
  });
</script>

<Card class="h-full">
  <CardHeader class="pb-3">
    <CardTitle class="text-base">Budget vs Actual</CardTitle>
  </CardHeader>
  <CardContent class="space-y-3">
    {#if rows.length === 0}
      <p class="py-6 text-center text-sm text-slate-500">No category limits to display.</p>
    {:else}
      {#each rows as row}
        <div class="space-y-1.5">
          <div class="flex items-baseline justify-between gap-3 text-sm">
            <span class="truncate text-slate-300">{row.label}</span>
            <span class="shrink-0 tabular-nums text-slate-400">
              <span class="{row.over ? 'text-rose-400' : 'text-slate-200'} font-medium">
                {formatCurrency(row.spent)}
              </span>
              <span class="text-slate-600"> / </span>
              {formatCurrency(row.budget)}
            </span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-[#1c2030]">
            <div
              class="h-1.5 rounded-full transition-all {row.over
                ? 'bg-rose-500'
                : row.pct >= 80
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'}"
              style="width: {Math.min(row.pct, 100)}%"
            ></div>
          </div>
        </div>
      {/each}
    {/if}
  </CardContent>
</Card>
