<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import { theme } from "$lib/stores/theme";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import type { FinanceItem } from "$lib/stores/finance";
  import type { BudgetPlan, BudgetPlanItem } from "@finance-app/shared-types";

  Chart.register(...registerables);

  type Period = "weekly" | "monthly" | "yearly";

  let {
    selectedPlan,
    costs,
  }: {
    selectedPlan: BudgetPlan | null;
    costs: FinanceItem[];
  } = $props();

  let barCanvas: HTMLCanvasElement | undefined = $state();
  let barChart: ChartInstance | undefined;
  let mounted = $state(false);

  function toMonthly(amount: number, period: Period): number {
    if (period === "weekly") return (amount * 52) / 12;
    if (period === "yearly") return amount / 12;
    return amount;
  }

  function spentForItem(item: BudgetPlanItem): number {
    if (!item.categoryId) return 0;
    return costs.filter((c) => c.categoryId === item.categoryId).reduce((sum, c) => sum + c.amount, 0);
  }

  const chartData = $derived.by(() => {
    if (!selectedPlan || selectedPlan.items.length === 0) return null;
    return {
      labels: selectedPlan.items.map((item) => item.categoryName ?? "General"),
      budgets: selectedPlan.items.map((item) => toMonthly(item.amount, item.period as Period)),
      spent: selectedPlan.items.map((item) => spentForItem(item)),
    };
  });

  function cssHsl(variable: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  const SPENT_OK = "hsl(142 71% 45% / 0.85)";
  const SPENT_OVER = "hsl(0 72% 51% / 0.85)";
  const SPENT_WARN = "hsl(43 96% 56% / 0.85)";

  function spentColor(spent: number, budget: number): string {
    const pct = budget > 0 ? spent / budget : 0;
    if (pct >= 1) return SPENT_OVER;
    if (pct >= 0.85) return SPENT_WARN;
    return SPENT_OK;
  }

  function render() {
    if (typeof window === "undefined" || !barCanvas || !chartData) return;
    barChart?.destroy();
    const { labels, budgets, spent } = chartData;
    barCanvas.parentElement!.style.minHeight = `${Math.max(labels.length * 56, 160)}px`;
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
              label: (ctx) =>
                ` ${ctx.dataset.label}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(ctx.parsed.x as number)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: cssHsl("--border", 0.5) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              font: { size: 11 },
              callback: (v) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 0,
                }).format(v as number),
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

  onMount(() => {
    mounted = true;
    render();
  });

  $effect(() => {
    if (!mounted) return;
    chartData;
    $theme;
    render();
  });
</script>

<Card class="h-full">
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
