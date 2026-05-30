<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import { theme } from "$lib/stores/theme";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import type { FinanceItem } from "$lib/stores/finance";
  import type { BudgetPlan } from "@finance-app/shared-types";
  import { toMonthly, spentForItem, spentColor } from "$lib/utils/budget";
  import { cssHsl, SPENT_OK, SPENT_WARN, SPENT_OVER } from "$lib/utils/chart";
  import { formatCurrency } from "$lib/utils/format";

  Chart.register(...registerables);

  let {
    budgetPlans,
    costs,
  }: {
    budgetPlans: BudgetPlan[];
    costs: FinanceItem[];
  } = $props();

  let selectedPlanId = $state<string | null>(null);
  let barCanvas: HTMLCanvasElement | undefined = $state();
  let donutCanvas: HTMLCanvasElement | undefined = $state();
  let barChart: ChartInstance | undefined;
  let donutChart: ChartInstance | undefined;
  let mounted = $state(false);
  let donutCenterX = $state(80);
  let donutCenterY = $state(80);

  $effect(() => {
    if (budgetPlans.length > 0 && (selectedPlanId === null || !budgetPlans.find((p) => p.id === selectedPlanId))) {
      selectedPlanId = budgetPlans[0].id;
    }
  });

  const selectedPlan = $derived(budgetPlans.find((p) => p.id === selectedPlanId) ?? budgetPlans[0] ?? null);

  const chartData = $derived.by(() => {
    if (!selectedPlan || selectedPlan.items.length === 0) return null;
    const items = selectedPlan.items;
    return {
      labels: items.map((item) => item.categoryName ?? "General"),
      budgets: items.map((item) => toMonthly(item.amount, item.period)),
      spent: items.map((item) => spentForItem(item, costs)),
    };
  });

  const utilizationData = $derived.by(() => {
    if (!selectedPlan || selectedPlan.items.length === 0) return null;
    const totalBudget = selectedPlan.items.reduce(
      (sum, item) => sum + toMonthly(item.amount, item.period),
      0,
    );
    const totalSpent = selectedPlan.items.reduce((sum, item) => sum + spentForItem(item, costs), 0);
    const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const remaining = Math.max(totalBudget - totalSpent, 0);
    const isOver = totalSpent > totalBudget;
    return { totalBudget, totalSpent, pct, remaining, isOver };
  });

  function renderBarChart() {
    if (typeof window === "undefined" || !barCanvas || !chartData) return;

    barChart?.destroy();

    const { labels, budgets, spent } = chartData;
    const minHeight = Math.max(labels.length * 56, 160);
    barCanvas.parentElement!.style.minHeight = `${minHeight}px`;

    barChart = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Budget",
            data: budgets,
            backgroundColor: cssHsl("--muted", 0.7),
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: "Spent",
            data: spent,
            backgroundColor: spent.map((s, i) => spentColor(s, budgets[i])),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "start",
            labels: {
              color: cssHsl("--muted-foreground"),
              boxWidth: 10,
              boxHeight: 10,
              borderRadius: 3,
              useBorderRadius: true,
              padding: 16,
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.x as number)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: cssHsl("--border", 0.5) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              font: { size: 11 },
              callback: (value) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 0,
                }).format(value as number),
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: cssHsl("--muted-foreground"), font: { size: 12 } },
          },
        },
      },
    });
  }

  function renderDonutChart() {
    if (typeof window === "undefined" || !donutCanvas || !utilizationData) return;

    donutChart?.destroy();

    const { totalSpent, remaining, isOver, totalBudget } = utilizationData;
    const spentFill = isOver ? SPENT_OVER : totalSpent / totalBudget >= 0.85 ? SPENT_WARN : SPENT_OK;

    donutChart = new Chart(donutCanvas, {
      type: "doughnut",
      plugins: [
        {
          id: "center-sync",
          afterLayout: (instance) => {
            const area = instance.chartArea;
            if (!area) return;
            donutCenterX = (area.left + area.right) / 2;
            donutCenterY = (area.top + area.bottom) / 2;
          },
        },
      ],
      data: {
        labels: isOver ? ["Over budget", "Budgeted"] : ["Spent", "Remaining"],
        datasets: [
          {
            data: isOver ? [totalSpent, 0] : [totalSpent, remaining],
            backgroundColor: [spentFill, cssHsl("--muted", 0.4)],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "74%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.parsed as number)}`,
            },
          },
        },
      },
    });
  }

  onMount(() => {
    mounted = true;
    renderBarChart();
    renderDonutChart();
  });

  $effect(() => {
    if (!mounted) return;
    chartData;
    utilizationData;
    $theme;
    renderBarChart();
    renderDonutChart();
  });


</script>

{#if budgetPlans.length > 0}
  <div class="space-y-4">
    <!-- Plan selector tabs -->
    {#if budgetPlans.length > 1}
      <div class="flex flex-wrap gap-2">
        {#each budgetPlans as plan (plan.id)}
          <button
            onclick={() => (selectedPlanId = plan.id)}
            class="rounded-full px-3.5 py-1 text-sm font-medium transition-colors {selectedPlanId === plan.id
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}"
          >
            {plan.name}
          </button>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Bar chart: budget vs actual per category -->
      <Card class="lg:col-span-2">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Budget vs Actual</CardTitle>
          <CardDescription>Monthly spending limits compared to actual expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          {#if chartData && chartData.labels.length > 0}
            <div class="relative" style="min-height: 160px;">
              <canvas bind:this={barCanvas}></canvas>
            </div>
          {:else}
            <p class="py-8 text-center text-sm text-slate-500">No category limits to display.</p>
          {/if}
        </CardContent>
      </Card>

      <!-- Utilization donut -->
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Budget utilization</CardTitle>
          <CardDescription>
            {selectedPlan?.name ?? ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {#if utilizationData}
            {@const { totalBudget, totalSpent, pct, isOver } = utilizationData}
            <div class="flex flex-col items-center gap-4">
              <div class="relative h-44 w-44">
                <canvas bind:this={donutCanvas}></canvas>
                <!-- Center label -->
                <div
                  class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  style="left: {donutCenterX - 72}px; top: {donutCenterY - 72}px; width: 144px; height: 144px;"
                >
                  <span
                    class="text-2xl font-bold {isOver
                      ? 'text-rose-400'
                      : pct >= 85
                        ? 'text-amber-400'
                        : 'text-emerald-400'}"
                  >
                    {Math.round(pct)}%
                  </span>
                  <span class="text-xs text-slate-500">used</span>
                </div>
              </div>
              <div class="w-full space-y-1.5 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-slate-400">Spent</span>
                  <span class="font-medium {isOver ? 'text-rose-400' : 'text-slate-200'}">{formatCurrency(totalSpent)}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-400">Budget</span>
                  <span class="font-medium text-slate-200">{formatCurrency(totalBudget)}</span>
                </div>
                {#if isOver}
                  <div class="flex items-center justify-between">
                    <span class="text-rose-500">Over by</span>
                    <span class="font-medium text-rose-400">{formatCurrency(totalSpent - totalBudget)}</span>
                  </div>
                {:else}
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Remaining</span>
                    <span class="font-medium text-emerald-400">{formatCurrency(utilizationData.remaining)}</span>
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <p class="py-8 text-center text-sm text-slate-500">No data.</p>
          {/if}
        </CardContent>
      </Card>
    </div>
  </div>
{/if}
