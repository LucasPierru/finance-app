<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import { theme } from "$lib/stores/theme";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import type { CostItem } from "$lib/utils/budget";
  import type { BudgetPlan } from "@finance-app/shared-types";
  import { toMonthly, spentForItem } from "$lib/utils/budget";
  import { cssHsl, SPENT_OK, SPENT_WARN, SPENT_OVER } from "$lib/utils/chart";
  import { formatCurrency } from "$lib/utils/format";

  Chart.register(...registerables);

  let {
    selectedPlan,
    costs,
  }: {
    selectedPlan: BudgetPlan | null;
    costs: CostItem[];
  } = $props();

  let donutCanvas: HTMLCanvasElement | undefined = $state();
  let donutChart: ChartInstance | undefined;
  let mounted = $state(false);
  let donutCenterX = $state(80);
  let donutCenterY = $state(80);

  const utilizationData = $derived.by(() => {
    if (!selectedPlan) return null;
    const expenseItems = selectedPlan.items.filter((i) => (i.flow ?? "expense") === "expense");
    if (expenseItems.length === 0) return null;
    const totalBudget = expenseItems.reduce(
      (sum, item) => sum + toMonthly(item.amount, item.period),
      0,
    );
    const totalSpent = expenseItems.reduce((sum, item) => sum + spentForItem(item, costs), 0);
    const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const remaining = Math.max(totalBudget - totalSpent, 0);
    const isOver = totalSpent > totalBudget;
    return { totalBudget, totalSpent, pct, remaining, isOver };
  });

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
              label: (ctx) => ` ${formatCurrency(ctx.parsed as number)}`,
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
