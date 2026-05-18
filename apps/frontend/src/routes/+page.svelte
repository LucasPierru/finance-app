<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import ExpenseTrendChart from "$lib/components/home/ExpenseTrendChart.svelte";
  import ExpenseDonutSummary from "$lib/components/home/ExpenseDonutSummary.svelte";
  import TransactionList from "$lib/components/home/TransactionList.svelte";
  import { Card, CardContent } from "$lib/components/ui/card";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  type HomeTab = "overview" | "expenses" | "transactions";

  interface DisplayTransaction {
    id: string;
    dateValue: string;
    dateLabel: string;
    name: string;
    merchant: string;
    category: string;
    amount: number;
    flow: "income" | "expense";
    source: "bank" | "manual";
  }

  interface MonthlyTransactionGroup {
    key: string;
    label: string;
    items: DisplayTransaction[];
  }

  const tabs: Array<{ id: HomeTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "expenses", label: "Expenses" },
    { id: "transactions", label: "Transactions" },
  ];

  let activeTab = $state<HomeTab>("overview");
  let selectedMonthKey = $state("");

  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
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

  function getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatMonthLabelFromKey(key: string): string {
    const date = parseLocalCalendarDate(`${key}-01`);
    if (!date) return "Current month";
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function formatDateLabel(dateValue: string): string {
    const parsed = parseLocalCalendarDate(dateValue);
    if (!parsed) return dateValue;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function buildSourceTransactions(): DisplayTransaction[] {
    if (financeView.categorizedBankTransactions.length > 0) {
      return financeView.categorizedBankTransactions
        .map((tx) => ({
          id: tx.transactionId,
          dateValue: tx.date,
          dateLabel: formatDateLabel(tx.date),
          name: tx.name,
          merchant: tx.merchantName ?? "-",
          category: tx.resolvedCategory,
          amount: Math.abs(tx.amount),
          flow: tx.flow,
          source: "bank" as const,
        }))
        .sort((a, b) => b.dateValue.localeCompare(a.dateValue));
    }

    const monthDate = new Date();
    const currentMonthDateValue = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;

    const manualCosts = financeView.costs.map((cost) => ({
      id: `manual-expense-${cost.id}`,
      dateValue: currentMonthDateValue,
      dateLabel: "Manual month entry",
      name: cost.name,
      merchant: "Manual",
      category: cost.category || "Other",
      amount: Math.abs(cost.amount),
      flow: "expense" as const,
      source: "manual" as const,
    }));

    const manualRevenues = financeView.revenues.map((revenue) => ({
      id: `manual-income-${revenue.id}`,
      dateValue: currentMonthDateValue,
      dateLabel: "Manual month entry",
      name: revenue.name,
      merchant: "Manual",
      category: revenue.category || "Other",
      amount: Math.abs(revenue.amount),
      flow: "income" as const,
      source: "manual" as const,
    }));

    return [...manualCosts, ...manualRevenues];
  }

  function groupTransactionsByMonth(items: DisplayTransaction[]): MonthlyTransactionGroup[] {
    const groups = new Map<string, MonthlyTransactionGroup>();

    for (const item of items) {
      const parsed = parseLocalCalendarDate(item.dateValue);
      if (!parsed) continue;

      const key = getMonthKey(parsed);
      const group = groups.get(key);
      if (group) {
        group.items.push(item);
      } else {
        groups.set(key, {
          key,
          label: parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          items: [item],
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
  }

  const sourceTransactions = $derived(buildSourceTransactions());
  const groupedByMonth = $derived(groupTransactionsByMonth(sourceTransactions));
  const currentMonthKey = $derived(getMonthKey(new Date()));

  const selectedMonthKeyOrCurrent = $derived(selectedMonthKey || currentMonthKey);
  const selectedMonthItems = $derived(
    groupedByMonth.find((group) => group.key === selectedMonthKeyOrCurrent)?.items ?? [],
  );

  const selectedMonthLabel = $derived(formatMonthLabelFromKey(selectedMonthKeyOrCurrent));

  const currentMonthDailyExpenseTrend = $derived.by(() => {
    const byDay = new Map<string, number>();

    for (const item of sourceTransactions) {
      if (item.flow !== "expense") continue;
      const parsed = parseLocalCalendarDate(item.dateValue);
      if (!parsed) continue;
      if (getMonthKey(parsed) !== currentMonthKey) continue;

      const key = item.dateValue;
      byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(item.amount));
    }

    const entries = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: entries.map(([date]) => formatDateLabel(date)),
      values: entries.map(([, amount]) => amount),
    };
  });

  const currentMonthExpenseTotal = $derived(
    currentMonthDailyExpenseTrend.values.reduce((sum, value) => sum + value, 0),
  );

  const selectedMonthExpenseBreakdown = $derived.by(() => {
    const byCategory = new Map<string, number>();
    for (const item of selectedMonthItems) {
      if (item.flow !== "expense") continue;
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + Math.abs(item.amount));
    }

    const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([category]) => category),
      values: entries.map(([, amount]) => amount),
      total: entries.reduce((sum, [, amount]) => sum + amount, 0),
    };
  });

  const selectedMonthExpenseTransactionCount = $derived(
    selectedMonthItems.filter((item) => item.flow === "expense").length,
  );

  const selectedMonthRevenueTotal = $derived(
    selectedMonthItems.filter((item) => item.flow === "income").reduce((sum, item) => sum + item.amount, 0),
  );

  const selectedMonthDelta = $derived(selectedMonthRevenueTotal - selectedMonthExpenseBreakdown.total);

  const selectedMonthDailyExpenseTrend = $derived.by(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(selectedMonthKeyOrCurrent);
    const daysCount = match ? new Date(Number(match[1]), Number(match[2]), 0).getDate() : 31;
    const days = new Array(daysCount).fill(0) as number[];
    for (const item of selectedMonthItems) {
      if (item.flow !== "expense") continue;
      const parsed = parseLocalCalendarDate(item.dateValue);
      if (!parsed) continue;
      const idx = parsed.getDate() - 1;
      if (idx >= 0 && idx < days.length) days[idx] += item.amount;
    }
    return {
      labels: Array.from({ length: daysCount }, (_, i) => String(i + 1)),
      values: days,
    };
  });

  const priorMonthKey = $derived.by(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(selectedMonthKeyOrCurrent);
    if (!match) return "";
    const d = new Date(Number(match[1]), Number(match[2]) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const priorMonthItems = $derived(groupedByMonth.find((g) => g.key === priorMonthKey)?.items ?? []);

  const priorMonthDailyExpenseValues = $derived.by(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(priorMonthKey);
    const daysCount = match ? new Date(Number(match[1]), Number(match[2]), 0).getDate() : 30;
    const days = new Array(daysCount).fill(0) as number[];
    for (const item of priorMonthItems) {
      if (item.flow !== "expense") continue;
      const parsed = parseLocalCalendarDate(item.dateValue);
      if (!parsed) continue;
      const idx = parsed.getDate() - 1;
      if (idx >= 0 && idx < days.length) days[idx] += item.amount;
    }
    return days;
  });

  const overviewRecentTransactions = $derived(sourceTransactions.slice(0, 3));

  $effect(() => {
    if (!selectedMonthKey) {
      selectedMonthKey = currentMonthKey;
    }
  });

  $effect(() => {
    const tab = page.url.searchParams.get("tab");
    const resolved: HomeTab = tab === "expenses" || tab === "transactions" ? tab : "overview";
    if (activeTab !== resolved) {
      activeTab = resolved;
    }
  });
</script>

<div class="animate-fade-up">
  <!-- Mobile: tab-driven via MobileInnerNav in layout -->
  <div class="md:hidden">
    {#if activeTab === "overview"}
      <div class="space-y-4">
        <ExpenseTrendChart
          labels={currentMonthDailyExpenseTrend.labels}
          values={currentMonthDailyExpenseTrend.values}
          totalLabel={`Total this month: ${formatCurrency(currentMonthExpenseTotal)}`}
        />
        <TransactionList
          title="Recent Transactions"
          subtitle="Latest 3 from synced bank data, or your manual entries if bank data is not available."
          items={overviewRecentTransactions}
          pageSize={3}
          hidePager={true}
        />
      </div>
    {/if}

    {#if activeTab === "expenses"}
      <div class="space-y-4">
        <MonthNavigation bind:value={selectedMonthKey} />
        <div class="rounded-xl border border-[#2a3247] bg-[#13161e]">
          <div class="grid grid-cols-3">
            <div class="flex flex-col items-center px-4 py-3">
              <p class="mb-1 text-xs font-medium text-slate-500">Revenue</p>
              <p class="text-base font-semibold text-emerald-400">{formatCurrency(selectedMonthRevenueTotal)}</p>
            </div>
            <div class="flex flex-col items-center px-4 py-3">
              <p class="mb-1 text-xs font-medium text-slate-500">Expenses</p>
              <p class="text-base font-semibold text-rose-400">{formatCurrency(selectedMonthExpenseBreakdown.total)}</p>
            </div>
            <div class="flex flex-col items-center px-4 py-3">
              <p class="mb-1 text-xs font-medium text-slate-500">Net</p>
              <p class="text-base font-semibold {selectedMonthDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                {selectedMonthDelta >= 0 ? "+" : ""}{formatCurrency(selectedMonthDelta)}
              </p>
            </div>
          </div>
        </div>
        <ExpenseDonutSummary
          labels={selectedMonthExpenseBreakdown.labels}
          values={selectedMonthExpenseBreakdown.values}
          total={selectedMonthExpenseBreakdown.total}
          transactionCount={selectedMonthExpenseTransactionCount}
        />
      </div>
    {/if}

    {#if activeTab === "transactions"}
      <div class="space-y-4">
        <MonthNavigation bind:value={selectedMonthKey} />
        <TransactionList
          title="All Transactions"
          subtitle={`${selectedMonthLabel} transactions (paginated).`}
          items={selectedMonthItems}
          pageSize={12}
        />
      </div>
    {/if}
  </div>

  <!-- Desktop: all sections shown directly -->
  <div class="hidden md:flex md:flex-col gap-6">
    <div class="flex items-center gap-4">
      <div class="flex-1">
        <MonthNavigation bind:value={selectedMonthKey} />
      </div>
    </div>

    <div class="rounded-xl border border-[#2a3247] bg-[#13161e]">
      <div class="grid grid-cols-3 divide-x divide-[#2a3247]">
        <div class="flex flex-col px-6 py-5">
          <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Revenue</p>
          <p class="text-2xl font-bold text-emerald-400">{formatCurrency(selectedMonthRevenueTotal)}</p>
        </div>
        <div class="flex flex-col px-6 py-5">
          <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Expenses</p>
          <p class="text-2xl font-bold text-rose-400">{formatCurrency(selectedMonthExpenseBreakdown.total)}</p>
        </div>
        <div class="flex flex-col px-6 py-5">
          <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Net</p>
          <p class="text-2xl font-bold {selectedMonthDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {selectedMonthDelta >= 0 ? "+" : ""}{formatCurrency(selectedMonthDelta)}
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-5 gap-6">
      <div class="col-span-3">
        <ExpenseTrendChart
          labels={selectedMonthDailyExpenseTrend.labels}
          values={selectedMonthDailyExpenseTrend.values}
          priorValues={priorMonthDailyExpenseValues}
          totalLabel={`${selectedMonthLabel} — ${formatCurrency(selectedMonthExpenseBreakdown.total)} spent`}
        />
      </div>
      <div class="col-span-2">
        <ExpenseDonutSummary
          labels={selectedMonthExpenseBreakdown.labels}
          values={selectedMonthExpenseBreakdown.values}
          total={selectedMonthExpenseBreakdown.total}
          transactionCount={selectedMonthExpenseTransactionCount}
        />
      </div>
    </div>

    <TransactionList title="Transactions" subtitle={selectedMonthLabel} items={selectedMonthItems} pageSize={12} />
  </div>
</div>
