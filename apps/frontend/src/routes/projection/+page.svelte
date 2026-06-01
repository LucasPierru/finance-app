<svelte:options runes={true} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import {
    investmentSettings,
    effectiveTotalRevenue,
    effectiveTotalCosts,
    calculateProjection,
  } from "$lib/stores/finance.js";
  import type { ProjectionPoint } from "$lib/stores/finance.js";
  import { theme } from "$lib/stores/theme";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import { cssHsl } from "$lib/utils/chart";
  import { formatCurrency } from "$lib/utils/format";
  import { toMonthly } from "$lib/utils/budget";
  import type { BudgetPlan } from "@finance-app/shared-types";
  import { Flame, AlertTriangle, Calculator } from "lucide-svelte";

  const budgetPlans = $derived<BudgetPlan[]>(page.data.budgetPlans ?? []);

  let chartCanvas = $state<HTMLCanvasElement | undefined>(undefined);
  let chartInstance = $state<import("chart.js").Chart | undefined>(undefined);

  let selectedPlanId = $state<string>(
    untrack(() => {
      const plans: BudgetPlan[] = page.data.budgetPlans ?? [];
      const fav = plans.find((p) => p.isFavorite);
      return (fav ?? plans[0])?.id ?? "";
    }),
  );

  // Scenario state (local, not persisted)
  let bearReturn = $state(4);
  let bullReturn = $state(10);
  let bearEnabled = $state(true);
  let bullEnabled = $state(true);

  // FIRE target (local, not persisted)
  let targetAmount = $state(0);

  // Inflation adjustment (local, not persisted)
  let showRealValues = $state(false);
  let inflationRate = $state(3);

  const selectedPlan = $derived(budgetPlans.find((p) => p.id === selectedPlanId) ?? null);

  const budgetMonthlyIncome = $derived.by(() => {
    if (!selectedPlan) return 0;
    return selectedPlan.items
      .filter((i) => i.flow === "income")
      .reduce((sum, i) => sum + toMonthly(i.amount, i.period), 0);
  });

  const budgetMonthlyExpenses = $derived.by(() => {
    if (!selectedPlan) return 0;
    return selectedPlan.items
      .filter((i) => (i.flow ?? "expense") === "expense")
      .reduce((sum, i) => sum + toMonthly(i.amount, i.period), 0);
  });

  const activeRevenue = $derived(selectedPlan ? budgetMonthlyIncome : $effectiveTotalRevenue);
  const activeCosts = $derived(selectedPlan ? budgetMonthlyExpenses : $effectiveTotalCosts);
  const activeSurplus = $derived(activeRevenue - activeCosts);

  const baseProjection = $derived(calculateProjection(activeRevenue, activeCosts, $investmentSettings));

  const bearProjection = $derived(
    bearEnabled
      ? calculateProjection(activeRevenue, activeCosts, { ...$investmentSettings, annualReturn: bearReturn })
      : null,
  );

  const bullProjection = $derived(
    bullEnabled
      ? calculateProjection(activeRevenue, activeCosts, { ...$investmentSettings, annualReturn: bullReturn })
      : null,
  );

  function realValue(balance: number, year: number): number {
    if (!showRealValues || year === 0) return balance;
    return balance / Math.pow(1 + inflationRate / 100, year);
  }

  const fireYear = $derived.by(() => {
    if (!targetAmount || targetAmount <= 0) return null;
    for (const point of baseProjection) {
      if (realValue(point.balance, point.year) >= targetAmount) return point.year;
    }
    return null;
  });

  // All chart data captured as a single derived so the effect tracks one dependency
  const chartData = $derived({
    base: baseProjection,
    bear: bearProjection,
    bull: bullProjection,
    annualReturn: $investmentSettings.annualReturn,
    bearReturn,
    bullReturn,
    bearEnabled,
    bullEnabled,
    targetAmount,
    showRealValues,
    inflationRate,
  });

  function fmtK(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return n.toFixed(0);
  }

  type ChartData = typeof chartData;

  function adjustedPoint(p: ProjectionPoint, data: ChartData): number {
    if (!data.showRealValues || p.year === 0) return p.balance;
    return p.balance / Math.pow(1 + data.inflationRate / 100, p.year);
  }

  async function renderChart(data: ChartData) {
    if (!chartCanvas) return;
    const { Chart, registerables } = await import("chart.js");
    Chart.register(...registerables);
    if (chartInstance) chartInstance.destroy();

    const labels = data.base.map((p) => `Yr ${p.year}`);

    const datasets: Parameters<typeof Chart>[1]["data"]["datasets"] = [
      {
        label: `Base (${data.annualReturn}%)`,
        data: data.base.map((p) => Math.round(adjustedPoint(p, data))),
        borderColor: cssHsl("--chart-1"),
        backgroundColor: cssHsl("--chart-1", 0.12),
        borderWidth: 2.5,
        pointBackgroundColor: cssHsl("--chart-1"),
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ];

    if (data.bearEnabled && data.bear) {
      datasets.push({
        label: `Pessimistic (${data.bearReturn}%)`,
        data: data.bear.map((p) => Math.round(adjustedPoint(p, data))),
        borderColor: cssHsl("--chart-3"),
        backgroundColor: "transparent",
        borderWidth: 2,
        // @ts-expect-error – valid Chart.js property
        borderDash: [5, 3],
        pointBackgroundColor: cssHsl("--chart-3"),
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.4,
      });
    }

    if (data.bullEnabled && data.bull) {
      datasets.push({
        label: `Optimistic (${data.bullReturn}%)`,
        data: data.bull.map((p) => Math.round(adjustedPoint(p, data))),
        borderColor: cssHsl("--chart-2"),
        backgroundColor: "transparent",
        borderWidth: 2,
        pointBackgroundColor: cssHsl("--chart-2"),
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.4,
      });
    }

    if (data.targetAmount > 0) {
      datasets.push({
        label: `Target ($${fmtK(data.targetAmount)})`,
        data: Array<number>(labels.length).fill(data.targetAmount),
        borderColor: cssHsl("--chart-4"),
        backgroundColor: "transparent",
        borderWidth: 1.5,
        // @ts-expect-error – valid Chart.js property
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        tension: 0,
      });
    }

    chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: cssHsl("--muted-foreground"),
              font: { family: "Plus Jakarta Sans", size: 12 },
              boxWidth: 12,
              boxHeight: 12,
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: cssHsl("--secondary"),
            borderColor: cssHsl("--border"),
            borderWidth: 1,
            titleColor: cssHsl("--foreground"),
            bodyColor: cssHsl("--muted-foreground"),
            titleFont: { family: "Bricolage Grotesque", size: 13, weight: 600 },
            bodyFont: { family: "Plus Jakarta Sans", size: 13 },
            padding: 10,
            callbacks: {
              label: (ctx) => `  ${ctx.dataset.label}: $${fmtK(ctx.raw as number)}`,
            },
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

  $effect(() => {
    $theme;
    const data = chartData;
    if (chartCanvas) renderChart(data);
  });

  onMount(() => {
    renderChart(chartData);
  });
</script>

<div class="animate-fade-up">
  <!-- Budget plan source selector -->
  {#if budgetPlans.length > 0}
    <div class="mb-5 flex items-center gap-3 rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-3">
      <span class="text-sm text-slate-400 shrink-0">Income source</span>
      <div class="h-9 max-w-xs">
        <Select type="single" bind:value={selectedPlanId}>
          <SelectTrigger class="w-full h-full text-sm">
            {selectedPlanId === ""
              ? "Finance data (automatic)"
              : (budgetPlans.find((p) => p.id === selectedPlanId)?.isFavorite ? "★ " : "") +
                (budgetPlans.find((p) => p.id === selectedPlanId)?.name ?? "")}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" label="Finance data (automatic)" />
            {#each budgetPlans as plan (plan.id)}
              <SelectItem value={plan.id} label="{plan.isFavorite ? '★ ' : ''}{plan.name}" />
            {/each}
          </SelectContent>
        </Select>
      </div>
      {#if selectedPlan}
        <span class="text-xs text-slate-500">
          {formatCurrency(budgetMonthlyIncome)}/mo income · {formatCurrency(budgetMonthlyExpenses)}/mo expenses
        </span>
      {/if}
    </div>
  {/if}

  <!-- Base settings -->
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
        class="h-10 text-base font-semibold"
      />
    </div>
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4 flex flex-col justify-between">
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
        Monthly Investment
        {#if selectedPlan}
          <span class="ml-1 normal-case font-normal text-slate-600">({selectedPlan.name})</span>
        {/if}
      </p>
      <span class="font-display text-xl font-700 {activeSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        {formatCurrency(activeSurplus)}
      </span>
    </div>
    <!-- FIRE target -->
    <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-4">
      <Label for="fire-target" class="mb-2 flex items-center gap-1.5">
        <Flame class="w-3.5 h-3.5 text-amber-400" />
        FIRE Target ($)
      </Label>
      <Input
        id="fire-target"
        type="number"
        bind:value={targetAmount}
        min="0"
        step="10000"
        placeholder="e.g. 1000000"
        class="h-10 text-base font-semibold"
      />
    </div>
  </div>

  {#if activeSurplus < 0}
    <div
      class="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 mb-5 text-rose-400 text-sm"
    >
      <AlertTriangle class="w-4 h-4 shrink-0" />
      {#if selectedPlan}
        Your budget expenses exceed income by <strong>{formatCurrency(Math.abs(activeSurplus))}/mo</strong>. Adjust your budget to start investing.
      {:else}
        Your expenses exceed revenue by <strong>{formatCurrency(Math.abs(activeSurplus))}/mo</strong>. Reduce costs to start investing.
      {/if}
    </div>
  {/if}

  <!-- Scenario comparison -->
  <div class="mb-5">
    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Scenario Comparison</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <!-- Pessimistic -->
      <div
        class="bg-[#13161e] border rounded-xl p-4 transition-opacity {bearEnabled
          ? 'border-[#252a3a]'
          : 'border-[#252a3a] opacity-50'}"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="inline-block w-5 border-t-2 border-dashed" style="border-color: hsl(var(--chart-3))"></span>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pessimistic</span>
          </div>
          <button
            onclick={() => (bearEnabled = !bearEnabled)}
            class="w-5 h-5 rounded border transition-colors flex items-center justify-center text-xs
              {bearEnabled
              ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-blue-400'
              : 'border-[#252a3a] text-slate-600'}"
            aria-label="Toggle pessimistic scenario"
          >
            {#if bearEnabled}✓{/if}
          </button>
        </div>
        <Input
          type="number"
          bind:value={bearReturn}
          min="0"
          max="50"
          step="0.5"
          disabled={!bearEnabled}
          class="h-9 text-base font-semibold mb-1"
        />
        <span class="text-xs text-slate-600">Annual return %</span>
      </div>

      <!-- Base (always on) -->
      <div class="bg-[#13161e] border border-[#3b82f6]/30 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="inline-block w-5 border-t-2" style="border-color: hsl(var(--chart-1))"></span>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Base</span>
          </div>
          <span class="text-xs text-slate-600">Always on</span>
        </div>
        <p class="font-display text-xl font-700 text-white mb-1">{$investmentSettings.annualReturn}%</p>
        <span class="text-xs text-slate-600">From settings above</span>
      </div>

      <!-- Optimistic -->
      <div
        class="bg-[#13161e] border rounded-xl p-4 transition-opacity {bullEnabled
          ? 'border-[#252a3a]'
          : 'border-[#252a3a] opacity-50'}"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="inline-block w-5 border-t-2" style="border-color: hsl(var(--chart-2))"></span>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Optimistic</span>
          </div>
          <button
            onclick={() => (bullEnabled = !bullEnabled)}
            class="w-5 h-5 rounded border transition-colors flex items-center justify-center text-xs
              {bullEnabled
              ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-blue-400'
              : 'border-[#252a3a] text-slate-600'}"
            aria-label="Toggle optimistic scenario"
          >
            {#if bullEnabled}✓{/if}
          </button>
        </div>
        <Input
          type="number"
          bind:value={bullReturn}
          min="0"
          max="50"
          step="0.5"
          disabled={!bullEnabled}
          class="h-9 text-base font-semibold mb-1"
        />
        <span class="text-xs text-slate-600">Annual return %</span>
      </div>
    </div>
  </div>

  <!-- FIRE milestone -->
  {#if targetAmount > 0}
    <div
      class="flex items-center gap-2.5 rounded-xl border px-4 py-3 mb-5 text-sm
        {fireYear !== null
        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
        : 'bg-amber-500/10 border-amber-500/25 text-amber-400'}"
    >
      <Flame class="w-4 h-4 shrink-0" />
      {#if fireYear !== null}
        At your base return of <strong class="mx-0.5">{$investmentSettings.annualReturn}%</strong>, you reach your
        <strong class="mx-0.5">{formatCurrency(targetAmount)}</strong> goal in
        <strong class="mx-0.5">Year {fireYear}</strong>{showRealValues ? " (inflation-adjusted)" : ""}.
      {:else}
        Your <strong class="mx-0.5">{formatCurrency(targetAmount)}</strong> goal is not reached within your
        <strong class="mx-0.5">{$investmentSettings.years}-year</strong> horizon at the base rate. Try extending the horizon or increasing the return.
      {/if}
    </div>
  {/if}

  <!-- Chart display options + chart -->
  <div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-5 mb-5">
    <!-- Display options bar -->
    <div class="flex items-center gap-3 mb-4">
      <button
        onclick={() => (showRealValues = !showRealValues)}
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
          {showRealValues
          ? 'bg-violet-500/15 border-violet-500/35 text-violet-400'
          : 'bg-[#1c2030] border-[#252a3a] text-slate-400 hover:text-slate-300'}"
      >
        <Calculator class="w-3.5 h-3.5" />
        {showRealValues ? "Real values" : "Nominal values"}
      </button>
      {#if showRealValues}
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <span>Inflation</span>
          <Input
            type="number"
            bind:value={inflationRate}
            min="0"
            max="20"
            step="0.1"
            class="w-20 h-7 text-sm py-0"
          />
          <span>%/yr</span>
        </div>
      {/if}
    </div>
    <div style="height:340px">
      <canvas bind:this={chartCanvas}></canvas>
    </div>
  </div>

  <!-- Milestone table -->
  <div class="bg-[#13161e] border border-[#252a3a] rounded-xl overflow-hidden">
    <div
      class="grid grid-cols-4 px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-[#1c2030] border-b border-[#252a3a]"
    >
      <span>Year</span>
      <span>Portfolio Value{showRealValues ? " (real)" : ""}</span>
      <span>Total Invested</span>
      <span>Gain</span>
    </div>
    {#each baseProjection as row}
      {#if row.year % 5 === 0 || row.year === 1}
        {@const adjustedBalance = Math.round(realValue(row.balance, row.year))}
        {@const adjustedInvested = Math.round(realValue(row.totalInvested, row.year))}
        {@const gain = adjustedBalance - adjustedInvested}
        {@const isFireYear = targetAmount > 0 && fireYear === row.year}
        <div
          class="grid grid-cols-4 px-5 py-3.5 text-sm border-b border-[#1c2030] last:border-none
                    hover:bg-[#1c2030] transition-colors items-center
                    {row.year === $investmentSettings.years ? 'bg-[#3b82f6]/10 border-[#3b82f6]/25' : ''}
                    {isFireYear ? 'bg-amber-500/8 border-amber-500/20' : ''}"
        >
          <span class="inline-flex items-center gap-2">
            <span class="bg-[#1c2030] border border-[#252a3a] rounded-md px-2 py-0.5 text-xs text-slate-400"
              >Yr {row.year}</span
            >
            {#if isFireYear}
              <Flame class="w-3.5 h-3.5 text-amber-400" />
            {/if}
          </span>
          <span class="font-display font-700 text-[#3b82f6]">{formatCurrency(adjustedBalance)}</span>
          <span class="text-slate-500">{formatCurrency(Math.max(0, adjustedInvested))}</span>
          <span class="{gain > 0 ? 'text-emerald-400' : 'text-rose-400'} font-medium">
            {gain > 0 ? "+" : ""}{formatCurrency(gain)}
          </span>
        </div>
      {/if}
    {/each}
  </div>
</div>
