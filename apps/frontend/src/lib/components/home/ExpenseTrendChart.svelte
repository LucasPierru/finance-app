<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Chart, registerables, type Chart as ChartInstance, type ChartDataset } from "chart.js";
  import { theme } from "$lib/stores/theme";

  Chart.register(...registerables);

  let {
    labels,
    values,
    priorValues = [] as number[],
    totalLabel,
    chartHeight = 260,
    class: className = "",
  }: {
    labels: string[];
    values: number[];
    priorValues?: number[];
    totalLabel: string;
    chartHeight?: number;
    class?: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined;
  let containerEl: HTMLDivElement | undefined;
  let chart: ChartInstance | undefined;
  let mounted = $state(false);

  function cssHsl(variableName: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  function buildCumulativeValues(raw: number[]): number[] {
    let running = 0;
    return raw.map((v) => (running += Math.max(0, v)));
  }

  const crosshairPlugin = {
    id: "crosshair",
    beforeDraw(c: ChartInstance) {
      const active = (c.tooltip as any)._active;
      if (!active?.length) return;
      const ctx = c.ctx;
      const x = active[0].element.x;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, c.scales.y.top);
      ctx.lineTo(x, c.scales.y.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    },
  };

  function renderChart() {
    if (typeof window === "undefined" || !canvas || !containerEl) return;

    chart?.destroy();

    const safeLabels = labels.length > 0 ? labels : ["No data"];
    const safeValues = values.length > 0 ? buildCumulativeValues(values) : [0];
    const cumPrior = priorValues.length > 0 ? buildCumulativeValues(priorValues) : [];

    const datasets: ChartDataset<"line">[] = [
      {
        data: safeValues,
        fill: true,
        cubicInterpolationMode: "monotone",
        borderColor: cssHsl("--chart-1"),
        borderWidth: 2,
        pointRadius: 0,
        backgroundColor: cssHsl("--chart-1", 0.2),
      },
    ];

    if (cumPrior.length > 0) {
      datasets.push({
        data: cumPrior,
        fill: false,
        cubicInterpolationMode: "monotone",
        borderColor: "rgba(148,163,184,0.35)",
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        backgroundColor: "transparent",
      });
    }

    chart = new Chart(canvas, {
      type: "line",
      plugins: [crosshairPlugin],
      data: { labels: safeLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Day ${items[0].label}`,
              label: (ctx) => {
                const name = ctx.datasetIndex === 0 ? "This month" : "Prior month";
                const val = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format((ctx.raw as number) ?? 0);
                return `${name}: ${val}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: cssHsl("--muted-foreground"), maxTicksLimit: 8 },
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
    priorValues;
    $theme;
    renderChart();
  });

  onMount(() => {
    mounted = true;

    const obs = new ResizeObserver(() => {
      chart?.resize();
    });

    if (containerEl) obs.observe(containerEl);

    return () => {
      chart?.destroy();
      obs.disconnect();
    };
  });
</script>

<div
  class="flex flex-col h-full overflow-hidden rounded-xl border border-[#252a3a] bg-[#13161e] text-slate-100 shadow-sm {className}"
>
  <div class="p-5 pb-2">
    <p class="text-xl font-semibold">Expense Trend</p>
    <p class="mt-1 text-sm text-slate-400">{totalLabel}</p>
  </div>
  <div
    bind:this={containerEl}
    style="flex: 1 1 0%; min-height: {chartHeight}px; padding: 0 20px 16px; position: relative;"
  >
    <canvas bind:this={canvas}></canvas>
  </div>
</div>
