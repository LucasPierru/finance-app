<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import { theme } from "$lib/stores/theme";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";

  Chart.register(...registerables);

  let {
    labels,
    values,
    total,
    transactionCount = 0,
  }: {
    labels: string[];
    values: number[];
    total: number;
    transactionCount?: number;
  } = $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: ChartInstance | undefined;
  let mounted = $state(false);
  let centerX = $state(128);
  let centerY = $state(128);
  let categoryMode = $state<"main" | "all">("main");

  const formattedTotal = $derived(
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(total),
  );

  const transactionText = $derived(
    transactionCount > 0
      ? `${transactionCount} ${transactionCount === 1 ? "transaction" : "transactions"}`
      : "No transaction",
  );

  const chartEntries = $derived.by(() => {
    const entries = labels
      .map((label, index) => ({
        label,
        value: Math.max(0, values[index] ?? 0),
      }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);

    if (entries.length === 0) {
      return [{ label: "No expenses", value: 1 }];
    }

    if (categoryMode === "all") {
      return entries;
    }

    const mainCategories = entries.slice(0, 5);
    const otherTotal = entries.slice(5).reduce((sum, entry) => sum + entry.value, 0);

    return otherTotal > 0 ? [...mainCategories, { label: "Other", value: otherTotal }] : mainCategories;
  });

  function cssHsl(variableName: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  function categoryPalette(label: string, index: number): string {
    if (label === "Other") {
      return cssHsl("--muted-foreground", 0.5);
    }
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
    return cssHsl(vars[index % vars.length]);
  }

  function renderChart() {
    if (typeof window === "undefined" || !canvas) return;

    chart?.destroy();

    const safeLabels = chartEntries.map((entry) => entry.label);
    const safeValues = chartEntries.map((entry) => entry.value);
    const hasExpenseData = labels.length > 0 && values.some((value) => value > 0);

    chart = new Chart(canvas, {
      type: "doughnut",
      plugins: [
        {
          id: "center-position-sync",
          afterLayout: (instance) => {
            const area = instance.chartArea;
            if (!area) return;
            centerX = (area.left + area.right) / 2;
            centerY = (area.top + area.bottom) / 2;
          },
        },
      ],
      data: {
        labels: safeLabels,
        datasets: [
          {
            data: safeValues,
            backgroundColor: safeLabels.map((label, index) =>
              hasExpenseData ? categoryPalette(label, index) : cssHsl("--muted", 0.65),
            ),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
        interaction: {
          mode: "nearest",
          intersect: true,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = (ctx.raw as number) ?? 0;
                return `${ctx.label}: ${new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(value)}`;
              },
            },
          },
        },
      },
    });
  }

  $effect(() => {
    if (!mounted) return;
    labels;
    values;
    categoryMode;
    $theme;
    renderChart();
  });

  onMount(() => {
    mounted = true;
    renderChart();

    return () => {
      chart?.destroy();
    };
  });
</script>

<Card class="grow w-full">
  <CardHeader>
    <CardTitle class="font-display text-xl">Expense Summary</CardTitle>
  </CardHeader>
  <CardContent class="space-y-4">
    <div class="relative mx-auto h-64 w-64">
      <canvas class="relative z-10 cursor-pointer" bind:this={canvas}></canvas>
      <div
        class="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center"
        style={`left: ${centerX}px; top: ${centerY}px;`}
      >
        <p class="font-display text-xl font-semibold text-rose-400">{formattedTotal}</p>
        <p class="text-xs text-muted-foreground">{transactionText}</p>
      </div>
    </div>
    <div class="flex items-center justify-center gap-2">
      <Button
        size="sm"
        variant={categoryMode === "main" ? "default" : "outline"}
        onclick={() => {
          categoryMode = "main";
        }}>Main categories</Button
      >
      <Button
        size="sm"
        variant={categoryMode === "all" ? "default" : "outline"}
        onclick={() => {
          categoryMode = "all";
        }}>All categories</Button
      >
    </div>
  </CardContent>
</Card>
