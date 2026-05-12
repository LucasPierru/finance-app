<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance } from "chart.js";
  import { theme } from "$lib/stores/theme";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";

  Chart.register(...registerables);

  let {
    labels,
    values,
    total,
    monthLabel,
  }: {
    labels: string[];
    values: number[];
    total: number;
    monthLabel: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: ChartInstance | undefined;
  let mounted = $state(false);

  const formattedTotal = $derived(
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(total),
  );

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

  function renderChart() {
    if (typeof window === "undefined" || !canvas) return;

    chart?.destroy();

    const safeLabels = labels.length > 0 ? labels : ["No expenses"];
    const safeValues = values.length > 0 ? values : [1];

    chart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: safeLabels,
        datasets: [
          {
            data: safeValues,
            backgroundColor: safeLabels.map((_, index) =>
              labels.length > 0 ? categoryPalette(index) : cssHsl("--muted", 0.65),
            ),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: cssHsl("--muted-foreground"),
              boxWidth: 12,
              boxHeight: 12,
            },
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

<Card>
  <CardHeader>
    <CardTitle class="font-display text-xl">Expense Summary</CardTitle>
    <CardDescription>{monthLabel}</CardDescription>
  </CardHeader>
  <CardContent>
    <div class="relative mx-auto h-64 w-64">
      <canvas bind:this={canvas}></canvas>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p class="text-xs uppercase tracking-wider text-slate-500">Total</p>
        <p class="font-display text-2xl font-semibold text-rose-400">{formattedTotal}</p>
      </div>
    </div>
  </CardContent>
</Card>
