<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import MetricCard from "$lib/components/MetricCard.svelte";
  import BreakdownCard from "$lib/components/BreakdownCard.svelte";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { theme } from "$lib/stores/theme";
  import {
    calculateProjection,
    emptyBankState,
    emptyFinanceState,
    getEffectiveFinanceView,
  } from "$lib/utils/finance-view";

  // Register chart types once per module instead of dynamic importing on every render.
  Chart.register(...registerables);

  let cashflowCanvas: HTMLCanvasElement | undefined;
  let expenseCanvas: HTMLCanvasElement | undefined;
  let projectionCanvas: HTMLCanvasElement | undefined;

  let cashflowChart: ChartInstance | undefined;
  let expenseChart: ChartInstance | undefined;
  let projectionChart: ChartInstance | undefined;
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

  function fmtCompact(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
  }

  function renderCashflowChart() {
    if (typeof window === "undefined" || !cashflowCanvas) return;
    cashflowChart?.destroy();
    const expenseByCategory = new Map<string, number>();

    for (const item of financeView.costs) {
      expenseByCategory.set(item.category, (expenseByCategory.get(item.category) ?? 0) + item.amount);
    }

    const expenseRows = [...expenseByCategory.entries()].sort((a, b) => b[1] - a[1]);

    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];

    expenseRows.forEach(([category, value], index) => {
      labels.push(category);
      values.push(value);
      colors.push(categoryPalette(index));
    });

    if (values.length === 0) {
      labels.push("No category data");
      values.push(1);
      colors.push(cssHsl("--muted"));
    }

    cashflowChart = new Chart(cashflowCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: cssHsl("--card"),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmt((ctx.raw as number) ?? 0)}`,
            },
          },
        },
      },
    });
  }

  function renderExpenseChart() {
    if (typeof window === "undefined" || !expenseCanvas) return;
    expenseChart?.destroy();

    const rankedCosts = [...financeView.costs].sort((a, b) => b.amount - a.amount).slice(0, 6);

    expenseChart = new Chart(expenseCanvas, {
      type: "bar",
      data: {
        labels: rankedCosts.map((c) => c.name),
        datasets: [
          {
            label: "Monthly Cost",
            data: rankedCosts.map((c) => c.amount),
            backgroundColor: cssHsl("--chart-4", 0.72),
            borderColor: cssHsl("--chart-4"),
            borderWidth: 1.2,
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
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
              callback: (value) => `$${fmtCompact(value as number)}`,
              font: { family: "Plus Jakarta Sans", size: 11 },
            },
          },
        },
      },
    });
  }

  function renderProjectionChart() {
    if (typeof window === "undefined" || !projectionCanvas) return;
    projectionChart?.destroy();

    projectionChart = new Chart(projectionCanvas, {
      type: "line",
      data: {
        labels: projection.map((p) => `Yr ${p.year}`),
        datasets: [
          {
            label: "Projected Balance",
            data: projection.map((p) => p.balance),
            borderColor: cssHsl("--chart-1"),
            backgroundColor: cssHsl("--chart-1", 0.16),
            borderWidth: 2.2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: "Total Invested",
            data: projection.map((p) => p.totalInvested),
            borderColor: cssHsl("--chart-2"),
            backgroundColor: cssHsl("--chart-2", 0.1),
            borderWidth: 1.6,
            borderDash: [6, 4],
            fill: false,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 12 },
            },
          },
        },
        scales: {
          x: {
            grid: { color: cssHsl("--border", 0.6) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 11 },
            },
          },
          y: {
            grid: { color: cssHsl("--border", 0.6) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              callback: (value) => `$${fmtCompact(value as number)}`,
              font: { family: "Plus Jakarta Sans", size: 11 },
            },
          },
        },
      },
    });
  }

  const projection = $derived(
    calculateProjection(financeView.totalRevenue, financeView.totalCosts, financeState.investmentSettings),
  );

  function renderCharts() {
    renderCashflowChart();
    renderExpenseChart();
    renderProjectionChart();
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
      cashflowChart?.destroy();
      expenseChart?.destroy();
      projectionChart?.destroy();
    };
  });
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Financial Overview" subtitle="Your money at a glance" />

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        label="Monthly Revenue"
        value={fmt(financeView.totalRevenue)}
        hint={financeView.isUsingSyncedCashflow
          ? `Based on ${financeView.revenues.length} synced income source${financeView.revenues.length !== 1 ? "s" : ""}`
          : `${financeView.revenues.length} source${financeView.revenues.length !== 1 ? "s" : ""}`}
        valueClass="text-emerald-400"
      />
      <MetricCard
        label="Monthly Costs"
        value={fmt(financeView.totalCosts)}
        hint={financeView.isUsingSyncedCashflow
          ? `Based on ${financeView.costs.length} synced expense source${financeView.costs.length !== 1 ? "s" : ""}`
          : `${financeView.costs.length} expense${financeView.costs.length !== 1 ? "s" : ""}`}
        valueClass="text-rose-400"
      />
      <MetricCard
        label="Monthly Surplus"
        value={fmt(financeView.monthlySurplus)}
        hint={financeView.monthlySurplus >= 0 ? "Available to invest" : "Deficit — reduce costs"}
        valueClass={financeView.monthlySurplus >= 0 ? "text-emerald-400" : "text-rose-400"}
      />
      <MetricCard
        label={`${financeState.investmentSettings.years}yr Projection`}
        value={projection.length ? fmt(projection[projection.length - 1].balance) : "$0"}
        hint={`at ${financeState.investmentSettings.annualReturn}% annual return`}
        valueClass="text-[#5b8dee]"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BreakdownCard variant="income" items={financeView.revenues} />
      <BreakdownCard variant="expense" items={financeView.costs} />
    </div>

    <div class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
          <CardDescription>Monthly cost distribution by expense category.</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-[260px]">
            <canvas bind:this={cashflowCanvas}></canvas>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Expense Drivers</CardTitle>
          <CardDescription>The largest recurring costs currently affecting your monthly burn rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-[260px]">
            <canvas bind:this={expenseCanvas}></canvas>
          </div>
        </CardContent>
      </Card>

      <Card class="xl:col-span-2">
        <CardHeader>
          <CardTitle>Long-Term Wealth Trajectory</CardTitle>
          <CardDescription>
            Projection of portfolio value versus total invested capital over {financeState.investmentSettings.years} years.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-[320px]">
            <canvas bind:this={projectionCanvas}></canvas>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
