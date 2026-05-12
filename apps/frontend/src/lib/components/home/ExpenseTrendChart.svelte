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
    totalLabel,
  }: {
    labels: string[];
    values: number[];
    totalLabel: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined;
  let chart: ChartInstance | undefined;
  let mounted = $state(false);

  function cssHsl(variableName: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  function renderChart() {
    if (typeof window === "undefined" || !canvas) return;

    chart?.destroy();

    const safeLabels = labels.length > 0 ? labels : ["No data"];
    const safeValues = values.length > 0 ? values : [0];

    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: safeLabels,
        datasets: [
          {
            data: safeValues,
            fill: true,
            tension: 0.35,
            borderColor: cssHsl("--chart-1"),
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: cssHsl("--chart-1", 0.2),
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
              label: (ctx) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2,
                }).format((ctx.raw as number) ?? 0),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: cssHsl("--muted-foreground"),
              maxTicksLimit: 7,
            },
          },
          y: {
            grid: { color: cssHsl("--border", 0.5) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              callback: (value) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(value as number),
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
    <CardTitle class="font-display text-xl">Current Month Expense Trend</CardTitle>
    <CardDescription>{totalLabel}</CardDescription>
  </CardHeader>
  <CardContent>
    <div class="h-52">
      <canvas bind:this={canvas}></canvas>
    </div>
  </CardContent>
</Card>
