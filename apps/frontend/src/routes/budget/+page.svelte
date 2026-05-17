<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  type BudgetView = "overview" | "categories" | "insights";

  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));

  const monthlyIncome = $derived(financeView.monthlyRevenue);
  const monthlyExpenses = $derived(financeView.monthlyCosts);
  const monthlySurplus = $derived(financeView.monthlySurplus);

  let activeBudgetView = $state<BudgetView>("overview");

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }

  $effect(() => {
    const section = page.url.searchParams.get("section");
    const resolved: BudgetView = section === "categories" || section === "insights" ? section : "overview";
    if (activeBudgetView !== resolved) {
      activeBudgetView = resolved;
    }
  });
</script>

<div class="animate-fade-up space-y-4 lg:space-y-6">
  {#if activeBudgetView === "overview"}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Monthly income</CardDescription>
          <CardTitle class="text-2xl text-emerald-400">{fmt(monthlyIncome)}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Monthly expenses</CardDescription>
          <CardTitle class="text-2xl text-rose-400">{fmt(monthlyExpenses)}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Available to budget</CardDescription>
          <CardTitle class="text-2xl {monthlySurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}"
            >{fmt(monthlySurplus)}</CardTitle
          >
        </CardHeader>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Budget workspace</CardTitle>
        <CardDescription>Start by defining your fixed buckets and spending caps for each category.</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-slate-400">
          This page is now live in navigation and ready for category-based budget rules. Next step can be adding monthly
          limits, usage progress bars, and over-budget alerts.
        </p>
      </CardContent>
    </Card>
  {:else if activeBudgetView === "categories"}
    <Card>
      <CardHeader>
        <CardTitle>Category budgets</CardTitle>
        <CardDescription>Set monthly limits for each spending category.</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-slate-400">Category budget builder can be added here next.</p>
      </CardContent>
    </Card>
  {:else}
    <Card>
      <CardHeader>
        <CardTitle>Budget insights</CardTitle>
        <CardDescription>Track over-budget trends and savings opportunities.</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-slate-400">Insights cards and alerts can be added here next.</p>
      </CardContent>
    </Card>
  {/if}
</div>
