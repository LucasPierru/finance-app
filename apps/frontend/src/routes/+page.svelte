<script lang="ts">
  import type { BudgetPlan } from "@finance-app/shared-types";
  import { page } from "$app/state";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import ExpenseTrendChart from "$lib/components/home/ExpenseTrendChart.svelte";
  import ExpenseDonutSummary from "$lib/components/home/ExpenseDonutSummary.svelte";
  import TransactionList from "$lib/components/home/TransactionList.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import BudgetBarChart from "$lib/components/BudgetBarChart.svelte";
  import BudgetDonutChart from "$lib/components/BudgetDonutChart.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";
  import { getMonthKey, formatMonthLabelFromKey, getPreviousMonthKey } from "$lib/utils/date";
  import { formatCurrency } from "$lib/utils/format";
  import {
    buildSourceTransactions,
    groupTransactionsByMonth,
    buildDailyExpenseTrend,
    buildMonthSummary,
    toDisplayTransaction,
  } from "$lib/utils/home-transactions";
  import { buildCurrentMonthCosts, type CostItem } from "$lib/utils/budget";

  type HomeTab = "overview" | "expenses" | "transactions";

  const activeTab = $derived.by<HomeTab>(() => {
    const tab = page.url.searchParams.get("tab");
    return tab === "expenses" || tab === "transactions" ? tab : "overview";
  });

  const financeView = $derived(
    getEffectiveFinanceView(
      page.data.initialFinanceState ?? emptyFinanceState,
      page.data.initialBankState ?? emptyBankState,
      page.data.allCategories ?? [],
    ),
  );
  const budgetPlans = $derived(page.data.budgetPlans ?? []);

  let budgetPlanId = $state<string | null>(null);
  const budgetPlan = $derived(budgetPlans.find((p: BudgetPlan) => p.id === budgetPlanId) ?? budgetPlans[0] ?? null);

  const sourceTransactions = $derived(buildSourceTransactions(financeView));
  const groupedByMonth = $derived(groupTransactionsByMonth(sourceTransactions));
  const selectedMonthKey = $derived(page.data.txMonth || getMonthKey(new Date()));
  const selectedMonthItems = $derived(groupedByMonth.find((g) => g.key === selectedMonthKey)?.items ?? []);
  const selectedMonthLabel = $derived(formatMonthLabelFromKey(selectedMonthKey));
  const previousMonthKey = $derived(getPreviousMonthKey(selectedMonthKey));

  const selectedMonthSummary = $derived(
    buildMonthSummary(page.data.currentMonthSummary, selectedMonthItems, page.data.pagedTransactions?.total),
  );

  const selectedMonthDailyTrend = $derived.by(() => {
    const values = buildDailyExpenseTrend(selectedMonthKey, page.data.currentMonthSummary?.dailyExpenseBreakdown, selectedMonthItems);
    const today = new Date();
    const isCurrentMonth = selectedMonthKey === getMonthKey(today);
    const cutoff = isCurrentMonth ? today.getDate() : values.length;
    const capped = values.map((v, i) => (i < cutoff ? v : null)) as (number | null)[];
    return { labels: Array.from({ length: values.length }, (_, i) => String(i + 1)), values: capped };
  });

  const previousMonthDailyExpenseValues = $derived(
    buildDailyExpenseTrend(
      previousMonthKey,
      page.data.previousMonthSummary?.dailyExpenseBreakdown,
      groupedByMonth.find((g) => g.key === previousMonthKey)?.items ?? [],
    ),
  );

  const currentMonthCosts = $derived<CostItem[]>(
    buildCurrentMonthCosts(
      page.data.currentMonthSummary?.categoryBreakdown ?? [],
      page.data.currentMonthSummary?.subCategoryBreakdown ?? [],
      page.data.allCategories ?? [],
      financeView.costs,
    ),
  );

  const pagedDisplayTransactions = $derived(page.data.pagedTransactions?.transactions.map(toDisplayTransaction) ?? []);
</script>

<div class="animate-fade-up grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
  <!-- Tab switcher: mobile only, inline (not sticky) -->
  <div class="col-span-1 md:hidden">
    <SegmentedControl
      items={[
        { id: "overview", label: "Overview", href: "/?tab=overview" },
        { id: "expenses", label: "Expenses", href: "/?tab=expenses" },
        { id: "transactions", label: "Transactions", href: "/?tab=transactions" },
      ]}
      active={activeTab}
    />
  </div>

  <!-- Month Navigation: full-width across all tabs -->
  <div class="col-span-1 md:col-span-5">
    <MonthNavigation />
  </div>

  <!-- Monthly Summary: mobile expenses tab only, always on desktop -->
  <div
    class="{activeTab !== 'expenses'
      ? 'hidden md:block'
      : ''} col-span-1 md:col-span-5 rounded-xl border border-[#2a3247] bg-[#13161e]"
  >
    <div class="grid grid-cols-3 md:divide-x md:divide-[#2a3247]">
      <div class="flex flex-col items-center px-4 py-3 md:items-start md:px-6 md:py-5">
        <p class="mb-1 text-xs font-medium text-slate-500 md:mb-1.5 md:uppercase md:tracking-wide">Revenue</p>
        <p class="text-base font-semibold text-emerald-400 md:text-2xl md:font-bold">
          {formatCurrency(selectedMonthSummary.revenueTotal)}
        </p>
      </div>
      <div class="flex flex-col items-center px-4 py-3 md:items-start md:px-6 md:py-5">
        <p class="mb-1 text-xs font-medium text-slate-500 md:mb-1.5 md:uppercase md:tracking-wide">Expenses</p>
        <p class="text-base font-semibold text-rose-400 md:text-2xl md:font-bold">
          {formatCurrency(selectedMonthSummary.expenseBreakdown.total)}
        </p>
      </div>
      <div class="flex flex-col items-center px-4 py-3 md:items-start md:px-6 md:py-5">
        <p class="mb-1 text-xs font-medium text-slate-500 md:mb-1.5 md:uppercase md:tracking-wide">Net</p>
        <p
          class="text-base font-semibold {selectedMonthSummary.delta >= 0
            ? 'text-emerald-400'
            : 'text-rose-400'} md:text-2xl md:font-bold"
        >
          {selectedMonthSummary.delta >= 0 ? "+" : ""}{formatCurrency(selectedMonthSummary.delta)}
        </p>
      </div>
    </div>
    {#if selectedMonthSummary.transferCount > 0}
      <div class="border-t border-[#2a3247] px-4 py-2 text-xs text-slate-500 md:px-6 md:py-2.5">
        <span class="text-amber-500/80">⚠</span>
        {selectedMonthSummary.transferCount} internal transfer{selectedMonthSummary.transferCount === 1 ? "" : "s"} detected (credit card
        payments, account transfers) and excluded from totals.
      </div>
    {/if}
  </div>

  <!-- Expense Trend Chart: mobile overview tab only, col-3 on desktop -->
  <div class="{activeTab !== 'overview' ? 'hidden md:block' : ''} col-span-1 md:col-span-3">
    <ExpenseTrendChart
      labels={selectedMonthDailyTrend.labels}
      values={selectedMonthDailyTrend.values}
      previousValues={previousMonthDailyExpenseValues}
      totalLabel={`${selectedMonthLabel} — ${formatCurrency(selectedMonthSummary.expenseBreakdown.total)} spent`}
    />
  </div>

  <!-- Expense Donut Summary: mobile expenses tab only, col-2 on desktop -->
  <div class="{activeTab !== 'expenses' ? 'hidden md:block' : ''} col-span-1 md:col-span-2">
    <ExpenseDonutSummary
      labels={selectedMonthSummary.expenseBreakdown.labels}
      values={selectedMonthSummary.expenseBreakdown.values}
      total={selectedMonthSummary.expenseBreakdown.total}
      transactionCount={selectedMonthSummary.expenseTransactionCount}
    />
  </div>

  <!-- Budget Plans: mobile overview tab only, always on desktop -->
  {#if budgetPlans.length > 0}
    {#if budgetPlans.length > 1}
      <div class="{activeTab !== 'overview' ? 'hidden md:block' : ''} col-span-1 md:col-span-5">
        <div class="flex flex-wrap gap-2">
          {#each budgetPlans as plan (plan.id)}
            <button
              onclick={() => (budgetPlanId = plan.id)}
              class="rounded-full px-3.5 py-1 text-sm font-medium transition-colors {budgetPlan?.id === plan.id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}"
            >
              {plan.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    <div class="{activeTab !== 'overview' ? 'hidden md:block' : ''} col-span-1 md:col-span-2">
      <BudgetDonutChart selectedPlan={budgetPlan} costs={currentMonthCosts} />
    </div>
    <div class="{activeTab !== 'overview' ? 'hidden md:block' : ''} col-span-1 md:col-span-3">
      <BudgetBarChart selectedPlan={budgetPlan} costs={currentMonthCosts} />
    </div>
  {/if}

  <!-- Recent Transactions: mobile overview tab only, never on desktop -->
  <div class="{activeTab !== 'overview' ? 'hidden' : ''} col-span-1 md:hidden">
    <TransactionList
      title="Recent Transactions"
      subtitle="Latest 3 from synced bank data, or your manual entries if bank data is not available."
      items={sourceTransactions.slice(0, 3)}
      pageSize={3}
      hidePager={true}
    />
  </div>

  <!-- All Transactions (card view): mobile transactions tab only, never on desktop -->
  <div class="{activeTab !== 'transactions' ? 'hidden' : ''} col-span-1 space-y-4 md:hidden">
    <TransactionList
      title="All Transactions"
      subtitle={`${selectedMonthLabel} — ${page.data.pagedTransactions?.total ?? 0} transaction${
        (page.data.pagedTransactions?.total ?? 0) === 1 ? "" : "s"
      }`}
      items={pagedDisplayTransactions}
      pageSize={12}
      hidePager={true}
    />
    <Pagination currentPage={page.data.txPage} totalPages={page.data.pagedTransactions?.totalPages ?? 1} />
  </div>

  <!-- Transactions Table: desktop only -->
  <Card class="col-span-1 hidden md:col-span-5 md:block">
    <CardHeader>
      <CardTitle class="font-display text-xl">Transactions</CardTitle>
      <CardDescription>
        {selectedMonthLabel} — {page.data.pagedTransactions?.total ?? 0} transaction{(page.data.pagedTransactions
          ?.total ?? 0) === 1
          ? ""
          : "s"}
      </CardDescription>
    </CardHeader>
    <CardContent class="p-0">
      {#if pagedDisplayTransactions.length === 0}
        <p class="px-6 py-10 text-center text-sm text-slate-500">No transactions for this period.</p>
      {:else}
        <Table class="table-fixed w-full">
          <TableHeader class="border-y border-[#252a3a] bg-[#1c2030]">
            <TableRow class="border-0 hover:bg-transparent">
              <TableHead class="w-[110px] px-3 py-3 text-xs text-slate-400">Date</TableHead>
              <TableHead class="w-[30%] px-3 py-3 text-xs text-slate-400">Name</TableHead>
              <TableHead class="w-[22%] px-3 py-3 text-xs text-slate-400">Merchant</TableHead>
              <TableHead class="w-[22%] px-3 py-3 text-xs text-slate-400">Category</TableHead>
              <TableHead class="w-[120px] px-3 py-3 text-right text-xs text-slate-400">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each pagedDisplayTransactions as tx (tx.id)}
              <TableRow class="border-[#252a3a] hover:bg-[#1c2030]">
                <TableCell class="whitespace-nowrap px-3 py-3 text-slate-400">{tx.dateLabel}</TableCell>
                <TableCell class="truncate px-3 py-3 font-medium text-slate-200" title={tx.name}>{tx.name}</TableCell>
                <TableCell class="truncate px-3 py-3 text-slate-400" title={tx.merchant}>{tx.merchant}</TableCell>
                <TableCell class="truncate px-3 py-3 text-slate-400">{tx.category}</TableCell>
                <TableCell
                  class="whitespace-nowrap px-3 py-3 text-right font-semibold {tx.flow === 'income'
                    ? 'text-emerald-400'
                    : 'text-rose-400'}"
                >
                  {tx.flow === "income" ? "+" : "-"}{formatCurrency(tx.amount, tx.isoCurrencyCode)}
                </TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
        <Pagination currentPage={page.data.txPage} totalPages={page.data.pagedTransactions?.totalPages ?? 1} />
      {/if}
    </CardContent>
  </Card>
</div>
