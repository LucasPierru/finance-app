<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import MetricCard from "$lib/components/MetricCard.svelte";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { theme } from "$lib/stores/theme";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";

  // Register chart types once per module instead of dynamic importing on every render.
  Chart.register(...registerables);

  let monthExpenseCanvas: HTMLCanvasElement | undefined;

  let monthExpenseChart: ChartInstance | undefined;
  let mounted = $state(false);
  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState));

  function cssHsl(variableName: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  function categoryPalette(index: number): string {
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
    return cssHsl(vars[index % vars.length]);
  }

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
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

  function isCurrentMonth(dateValue: string): boolean {
    const parsedDate = parseLocalCalendarDate(dateValue);
    if (!parsedDate) return false;

    const today = new Date();
    return parsedDate.getFullYear() === today.getFullYear() && parsedDate.getMonth() === today.getMonth();
  }

  const accountSummary = $derived.by(() => {
    const accounts = bankState.accounts;
    const bankAccounts = accounts.filter((account: (typeof accounts)[number]) => account.type === "depository");
    const creditCards = accounts.filter((account: (typeof accounts)[number]) => account.type === "credit");
    const loans = accounts.filter((account: (typeof accounts)[number]) => account.type === "loan");
    const investments = accounts.filter((account: (typeof accounts)[number]) => account.type === "investment");

    const totalBalance = (list: typeof accounts) =>
      list.reduce((sum: number, account: (typeof accounts)[number]) => sum + (account.currentBalance ?? 0), 0);

    return {
      bank: { count: bankAccounts.length, total: totalBalance(bankAccounts) },
      credit: { count: creditCards.length, total: totalBalance(creditCards) },
      loans: { count: loans.length, total: totalBalance(loans) },
      investments: { count: investments.length, total: totalBalance(investments) },
    };
  });

  const currentMonthExpenseByCategory = $derived.by(() => {
    const byCategory = new Map<string, number>();

    for (const transaction of financeView.categorizedBankTransactions) {
      if (transaction.flow !== "expense") continue;
      if (!isCurrentMonth(transaction.date)) continue;

      const category = transaction.resolvedCategory || "Other";
      byCategory.set(category, (byCategory.get(category) ?? 0) + Math.abs(transaction.amount));
    }

    if (byCategory.size === 0) {
      for (const expense of financeView.costs) {
        const category = expense.category || "Other";
        byCategory.set(category, (byCategory.get(category) ?? 0) + expense.amount);
      }
    }

    return [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  });

  const currentMonthExpenseTotal = $derived(
    currentMonthExpenseByCategory.reduce((sum: number, [, amount]: [string, number]) => sum + amount, 0),
  );

  function renderCurrentMonthExpenseChart() {
    if (typeof window === "undefined" || !monthExpenseCanvas) return;
    monthExpenseChart?.destroy();

    const labels = currentMonthExpenseByCategory.map(([category]) => category);
    const values = currentMonthExpenseByCategory.map(([, amount]) => amount);

    const colors: string[] = [];

    labels.forEach((_, index) => {
      colors.push(categoryPalette(index));
    });

    if (values.length === 0) {
      labels.push("No category data");
      values.push(1);
      colors.push(cssHsl("--muted"));
    }

    monthExpenseChart = new Chart(monthExpenseCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Expenses",
            data: values,
            backgroundColor: colors,
            borderColor: cssHsl("--chart-4"),
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmt((ctx.raw as number) ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 11 },
            },
          },
          y: {
            grid: { color: cssHsl("--border", 0.6) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              callback: (value) => fmt(value as number),
              font: { family: "Plus Jakarta Sans", size: 11 },
            },
          },
        },
      },
    });
  }

  function renderCharts() {
    renderCurrentMonthExpenseChart();
  }

  $effect(() => {
    if (!mounted) return;
    $theme;
    renderCharts();
  });

  onMount(() => {
    mounted = true;
    renderCharts();

    return () => {
      monthExpenseChart?.destroy();
    };
  });
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Overview" subtitle="Account summary and current month spending" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        label="Bank Accounts"
        value={fmt(accountSummary.bank.total)}
        hint={`${accountSummary.bank.count} account${accountSummary.bank.count !== 1 ? "s" : ""}`}
        valueClass="text-[#5b8dee]"
      />
      <MetricCard
        label="Credit Cards"
        value={fmt(accountSummary.credit.total)}
        hint={`${accountSummary.credit.count} card${accountSummary.credit.count !== 1 ? "s" : ""}`}
        valueClass="text-rose-400"
      />
      <MetricCard
        label="Loans"
        value={fmt(accountSummary.loans.total)}
        hint={`${accountSummary.loans.count} loan account${accountSummary.loans.count !== 1 ? "s" : ""}`}
        valueClass="text-amber-400"
      />
      <MetricCard
        label="Investments"
        value={fmt(accountSummary.investments.total)}
        hint={`${accountSummary.investments.count} investment account${accountSummary.investments.count !== 1 ? "s" : ""}`}
        valueClass="text-emerald-400"
      />
    </div>

    <div class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card class="xl:col-span-2">
        <CardHeader>
          <CardTitle>Current Month Expenses</CardTitle>
          <CardDescription>
            {bankState.connected
              ? "Based on synced transactions grouped by category."
              : "No synced bank data. Using your manual expense entries."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="mb-4 rounded-md border border-[#252a3a] bg-[#13161e] px-4 py-3">
            <p class="text-xs uppercase tracking-wider text-slate-500">Total this month</p>
            <p class="mt-1 text-2xl font-display font-semibold text-rose-400">{fmt(currentMonthExpenseTotal)}</p>
          </div>
          <div class="h-[300px]">
            <canvas bind:this={monthExpenseCanvas}></canvas>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
