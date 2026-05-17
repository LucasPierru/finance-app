<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import {
    investmentSettings,
    effectiveTotalRevenue,
    effectiveTotalCosts,
    effectiveMonthlySurplus,
    calculateProjection,
  } from "$lib/stores/finance.js";
  import { theme } from "$lib/stores/theme";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let chartCanvas = $state<HTMLCanvasElement | undefined>(undefined);
  let chartInstance = $state<import("chart.js").Chart | undefined>(undefined);

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  function fmtK(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return n.toFixed(0);
  }

  function cssHsl(variableName: string, alpha?: number): string {
    if (typeof window === "undefined") return "#000000";
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return "#000000";
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  }

  async function renderChart(data: { year: number; balance: number }[]) {
    if (!chartCanvas) return;
    const { Chart, registerables } = await import("chart.js");
    Chart.register(...registerables);
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: data.map((p) => `Yr ${p.year}`),
        datasets: [
          {
            label: "Portfolio",
            data: data.map((p) => p.balance),
            borderColor: cssHsl("--chart-1"),
            backgroundColor: cssHsl("--chart-1", 0.14),
            borderWidth: 2.5,
            pointBackgroundColor: cssHsl("--chart-1"),
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssHsl("--secondary"),
            borderColor: cssHsl("--border"),
            borderWidth: 1,
            titleColor: cssHsl("--foreground"),
            bodyColor: cssHsl("--chart-1"),
            titleFont: { family: "Bricolage Grotesque", size: 13, weight: 600 },
            bodyFont: { family: "Plus Jakarta Sans", size: 13 },
            padding: 10,
            callbacks: { label: (ctx) => `  $${fmtK(ctx.raw as number)}` },
          },
        },
        scales: {
          x: {
            grid: { color: cssHsl("--border", 0.6) },
            ticks: { color: cssHsl("--muted-foreground"), font: { family: "Plus Jakarta Sans", size: 11 } },
          },
          y: {
            grid: { color: cssHsl("--border", 0.6) },
            ticks: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 11 },
              callback: (v) => "$" + fmtK(v as number),
            },
          },
        },
      },
    });
  }

  const projection = $derived(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings));

  $effect(() => {
    $theme;
    if (chartCanvas) renderChart(projection);
  });

  onMount(() => {
    renderChart(projection);
  });
</script>

<div class="animate-fade-up">
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="annual-return" class="mb-2 block">Annual Return %</Label>
      <Input
        id="annual-return"
        type="number"
        bind:value={$investmentSettings.annualReturn}
        min="0"
        max="50"
        step="0.5"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="time-horizon" class="mb-2 block">Time Horizon (yrs)</Label>
      <Input
        id="time-horizon"
        type="number"
        bind:value={$investmentSettings.years}
        min="1"
        max="50"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="starting-amount" class="mb-2 block">Starting Amount</Label>
      <Input
        id="starting-amount"
        type="number"
        bind:value={$investmentSettings.initialAmount}
        min="0"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="dividend-yield" class="mb-2 block">Dividend Yield %</Label>
      <Input
        id="dividend-yield"
        type="number"
        bind:value={$investmentSettings.dividendYield}
        min="0"
        max="20"
        step="0.1"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="income-growth" class="mb-2 block">Income Growth %</Label>
      <Input
        id="income-growth"
        type="number"
        bind:value={$investmentSettings.incomeGrowth}
        min="-10"
        max="20"
        step="0.1"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="expense-growth" class="mb-2 block">Expense Growth %</Label>
      <Input
        id="expense-growth"
        type="number"
        bind:value={$investmentSettings.expenseGrowth}
        min="-10"
        max="20"
        step="0.1"
        onchange={() => {
          investmentSettings.update((s) => ({ ...s }));
          setTimeout(
            () => renderChart(calculateProjection($effectiveTotalRevenue, $effectiveTotalCosts, $investmentSettings)),
            10,
          );
        }}
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4 flex flex-col justify-between">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Monthly Investment</p>
      <span
        class="font-display text-xl font-700 {$effectiveMonthlySurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}"
      >
        {fmt($effectiveMonthlySurplus)}
      </span>
    </div>
  </div>

  {#if $effectiveMonthlySurplus < 0}
    <div
      class="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 mb-5 text-rose-400 text-sm"
    >
      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      Your expenses exceed revenue by <strong>{fmt(Math.abs($effectiveMonthlySurplus))}/mo</strong>. Reduce costs to
      start investing.
    </div>
  {/if}

  <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-5 mb-5" style="height:320px">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <div class="bg-[#13161e] border border-[#252a3a] rounded-xl overflow-hidden">
    <div
      class="grid grid-cols-4 px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-[#1c2030] border-b border-[#252a3a]"
    >
      <span>Year</span>
      <span>Portfolio Value</span>
      <span>Total Invested</span>
      <span>Gain</span>
    </div>
    {#each projection as row}
      {#if row.year % 5 === 0 || row.year === 1}
        {@const totalInvested = row.totalInvested}
        {@const gain = row.balance - row.totalInvested}
        <div
          class="grid grid-cols-4 px-5 py-3.5 text-sm border-b border-[#1c2030] last:border-none
                    hover:bg-[#1c2030] transition-colors items-center
                    {row.year === $investmentSettings.years ? 'bg-[#3b82f6]/10 border-[#3b82f6]/25' : ''}"
        >
          <span class="inline-flex">
            <span class="bg-[#1c2030] border border-[#252a3a] rounded-md px-2 py-0.5 text-xs text-slate-400"
              >Yr {row.year}</span
            >
          </span>
          <span class="font-display font-700 text-[#3b82f6]">{fmt(row.balance)}</span>
          <span class="text-slate-500">{fmt(Math.max(0, totalInvested))}</span>
          <span class="{gain > 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium">
            {gain > 0 ? "+" : ""}{fmt(gain)}
          </span>
        </div>
      {/if}
    {/each}
  </div>
</div>
