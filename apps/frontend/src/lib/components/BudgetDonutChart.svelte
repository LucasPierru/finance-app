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

  let donutCanvas: HTMLCanvasElement | undefined = $state();
  let donutChart: ChartInstance | undefined;
  let mounted = $state(false);
  let donutCenterX = $state(80);
  let donutCenterY = $state(80);

  function toMonthly(amount: number, period: Period): number {
    if (period === "weekly") return (amount * 52) / 12;
    if (period === "yearly") return amount / 12;
    return amount;
  }

  function spentForItem(item: BudgetPlanItem): number {
    if (!item.categoryId) return 0;
    return costs.filter((c) => c.categoryId === item.categoryId).reduce((sum, c) => sum + c.amount, 0);
  }

  const utilizationData = $derived.by(() => {
    if (!selectedPlan || selectedPlan.items.length === 0) return null;
    const totalBudget = selectedPlan.items.reduce(
      (sum, item) => sum + toMonthly(item.amount, item.period as Period),
      0,
    );
    const totalSpent = selectedPlan.items.reduce((sum, item) => sum + spentForItem(item), 0);
    const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const remaining = Math.max(totalBudget - totalSpent, 0);
    const isOver = totalSpent > totalBudget;
    return { totalBudget, totalSpent, pct, remaining, isOver };
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

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  function render() {
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
              label: (ctx) => ` ${fmt(ctx.parsed as number)}`,
            },
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
    utilizationData;
    $theme;
    render();
  });
</script>

<Card>
  <CardHeader class="pb-2">
    <CardTitle class="text-base">Budget Utilization</CardTitle>
    <CardDescription>{selectedPlan?.name ?? ""}</CardDescription>
  </CardHeader>
  <CardContent>
    {#if utilizationData}
      {@const { totalBudget, totalSpent, pct, isOver } = utilizationData}
      <div class="flex flex-col items-center gap-4">
        <div class="relative h-44 w-44">
          <canvas bind:this={donutCanvas}></canvas>
          <div
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            style="left: {donutCenterX - 72}px; top: {donutCenterY - 72}px; width: 144px; height: 144px;"
          >
            <span
              class="text-2xl font-bold {isOver ? 'text-rose-400' : pct >= 85 ? 'text-amber-400' : 'text-emerald-400'}"
            >
              {Math.round(pct)}%
            </span>
            <span class="text-xs text-slate-500">used</span>
          </div>
        </div>
        <div class="w-full space-y-1.5 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Spent</span>
            <span class="font-medium {isOver ? 'text-rose-400' : 'text-slate-200'}">{fmt(totalSpent)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Budget</span>
            <span class="font-medium text-slate-200">{fmt(totalBudget)}</span>
          </div>
          {#if isOver}
            <div class="flex items-center justify-between">
              <span class="text-rose-500">Over by</span>
              <span class="font-medium text-rose-400">{fmt(totalSpent - totalBudget)}</span>
            </div>
          {:else}
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Remaining</span>
              <span class="font-medium text-emerald-400">{fmt(utilizationData.remaining)}</span>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <p class="py-8 text-center text-sm text-slate-500">No data.</p>
    {/if}
  </CardContent>
</Card>
