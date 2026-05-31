<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";
  import { httpDeleteBudgetPlan } from "$lib/requests/budget";
  import BudgetPlanForm from "$lib/components/BudgetPlanForm.svelte";
  import BudgetBarChart from "$lib/components/BudgetBarChart.svelte";
  import BudgetDonutChart from "$lib/components/BudgetDonutChart.svelte";
  import MonthNavigation from "$lib/components/home/MonthNavigation.svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";
  import { toMonthly, periodLabel, itemProgress } from "$lib/utils/budget";
  import { formatCurrency } from "$lib/utils/format";
  import { getMonthKey } from "$lib/utils/date";

  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const allCategories = $derived(page.data.allCategories ?? []);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState, allCategories));
  const currentMonthSummary = $derived(page.data.currentMonthSummary);
  const selectedMonth = $derived(page.data.month ?? getMonthKey(new Date()));

  const currentMonthCosts = $derived.by<import("$lib/stores/finance").FinanceItem[]>(() => {
    const breakdown = currentMonthSummary?.categoryBreakdown ?? [];
    if (breakdown.length === 0) return financeView.costs;
    return breakdown.map((b: { category: string; totalAmount: number }, i: number) => {
      const cat = allCategories.find((c: import("@finance-app/shared-types").FinanceCategory) => c.type === "expense" && c.name === b.category);
      return {
        id: `month-${i}`,
        name: b.category,
        category: b.category,
        categoryId: cat?.id,
        amount: b.totalAmount,
        rawAmount: b.totalAmount.toFixed(2),
        frequency: "monthly" as const,
      };
    });
  });

  let budgetPlans = $state<BudgetPlan[]>(page.data.budgetPlans ?? []);
  const expenseCategories = $derived<FinanceCategory[]>(page.data.expenseCategories ?? []);

  let selectedPlanId = $state<string | null>(null);
  const selectedPlan = $derived(budgetPlans.find((p) => p.id === selectedPlanId) ?? budgetPlans[0] ?? null);

  $effect(() => {
    if (budgetPlans.length > 0 && (selectedPlanId === null || !budgetPlans.find((p) => p.id === selectedPlanId))) {
      selectedPlanId = budgetPlans[0].id;
    }
  });

  // Month navigation
  const isCurrentMonth = $derived(selectedMonth === getMonthKey(new Date()));

  // What fraction of the month has elapsed (0–100), only meaningful for current month
  const monthProgressPct = $derived.by(() => {
    if (!isCurrentMonth) return null;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Math.round((today.getDate() / daysInMonth) * 100);
  });

  function handleMonthChange(month: string) {
    const params = new URLSearchParams(page.url.searchParams);
    params.set("month", month);
    goto(`?${params}`, { replaceState: false, keepFocus: true });
  }

  // Plan health summary for selected plan
  const planHealth = $derived.by(() => {
    if (!selectedPlan || selectedPlan.items.length === 0) return null;
    let totalBudget = 0;
    let totalSpent = 0;
    let overCount = 0;
    for (const item of selectedPlan.items) {
      const { spent, monthly, over } = itemProgress(item, currentMonthCosts);
      totalBudget += monthly;
      totalSpent += spent;
      if (over) overCount++;
    }
    return { totalBudget, totalSpent, overCount };
  });

  // Modal state (desktop only)
  let showModal = $state(false);
  let editingPlan = $state<BudgetPlan | null>(null);

  function openModal() {
    editingPlan = null;
    showModal = true;
  }

  function openEditModal(plan: BudgetPlan) {
    editingPlan = plan;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingPlan = null;
  }

  function handlePlanCreated(plan: BudgetPlan) {
    budgetPlans = [...budgetPlans, plan];
    closeModal();
  }

  function handlePlanUpdated(plan: BudgetPlan) {
    budgetPlans = budgetPlans.map((p) => (p.id === plan.id ? plan : p));
    closeModal();
  }

  async function handleDeletePlan(planId: string) {
    try {
      await httpDeleteBudgetPlan(planId);
      budgetPlans = budgetPlans.filter((p) => p.id !== planId);
    } catch {
      // ignore
    }
  }
</script>

<div class="animate-fade-up space-y-4 lg:space-y-6">
  <!-- Month navigation -->
  <MonthNavigation value={selectedMonth} onchange={handleMonthChange} />

  <!-- Budget comparison charts -->
  {#if budgetPlans.length > 0}
    {#if budgetPlans.length > 1}
      <div class="flex flex-wrap gap-2">
        {#each budgetPlans as plan (plan.id)}
          <button
            onclick={() => (selectedPlanId = plan.id)}
            class="rounded-full px-3.5 py-1 text-sm font-medium transition-colors {selectedPlanId === plan.id
              ? 'bg-[#1c2030] text-slate-100'
              : 'text-slate-500 hover:bg-[#1c2030] hover:text-slate-300'}"
          >
            {plan.name}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Plan health summary -->
    {#if planHealth}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#252a3a] bg-[#13161e] px-4 py-2.5 text-sm shadow-sm">
        <span class="text-slate-400">
          <span class="{planHealth.totalSpent > planHealth.totalBudget ? 'text-rose-400' : 'text-slate-200'} font-medium">
            {formatCurrency(planHealth.totalSpent)}
          </span>
          <span class="text-slate-600"> / </span>
          {formatCurrency(planHealth.totalBudget)} budgeted
        </span>
        {#if planHealth.overCount > 0}
          <span class="text-rose-400">{planHealth.overCount} categor{planHealth.overCount === 1 ? "y" : "ies"} over</span>
        {:else}
          <span class="text-emerald-400">All categories on track</span>
        {/if}
        {#if isCurrentMonth && monthProgressPct !== null}
          <span class="ml-auto text-slate-500 text-xs">{monthProgressPct}% through the month</span>
        {/if}
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <BudgetBarChart {selectedPlan} costs={currentMonthCosts} />
      </div>
      <BudgetDonutChart {selectedPlan} costs={currentMonthCosts} />
    </div>
  {/if}

  <!-- Budget plans section -->
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>Budget plans</CardTitle>
          <CardDescription class="mt-1">Named budgets with category spending limits.</CardDescription>
        </div>
        <!-- Desktop: open modal -->
        <Button onclick={openModal} class="hidden gap-1.5 md:inline-flex">+ New budget</Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if budgetPlans.length === 0}
        <p class="py-8 text-center text-sm text-slate-500">
          No budget plans yet.
          <a href="/budget/new" class="text-slate-300 underline underline-offset-2 hover:text-white md:hidden">
            Create your first budget →
          </a>
          <button
            onclick={openModal}
            class="hidden text-slate-300 underline underline-offset-2 hover:text-white md:inline"
          >
            Create your first budget →
          </button>
        </p>
      {:else}
        <div class="space-y-4">
          {#each budgetPlans as plan (plan.id)}
            <div class="rounded-xl border border-[#252a3a] bg-[#13161e] p-4 space-y-3">
              <!-- Plan header -->
              <div class="flex items-center justify-between">
                <h3 class="font-semibold text-slate-200">{plan.name}</h3>
                <div class="flex items-center gap-1">
                  <!-- Mobile: navigate to edit page -->
                  <a
                    href="/budget/{plan.id}/edit"
                    class="md:hidden flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                    aria-label="Edit plan"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                    Edit
                  </a>
                  <!-- Desktop: open edit modal -->
                  <button
                    onclick={() => openEditModal(plan)}
                    class="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                    aria-label="Edit plan"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onclick={() => handleDeletePlan(plan.id)}
                    class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-slate-500 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
                    aria-label="Delete plan"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>

              <!-- Items -->
              {#if plan.items.length === 0}
                <p class="text-sm text-slate-600">No category limits set.</p>
              {:else}
                <div class="space-y-3">
                  {#each plan.items as item (item.id)}
                    {@const { spent, monthly, pct, over, remaining } = itemProgress(item, currentMonthCosts)}
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-300">
                          {item.categoryName ?? "General"}
                        </span>
                        <div class="flex items-baseline gap-2 shrink-0">
                          <span class="text-slate-400">
                            {formatCurrency(spent)}
                            <span class="text-slate-600">/</span>
                            {formatCurrency(item.amount)}
                            <span class="ml-1 text-xs text-slate-500">{periodLabel(item.period)}</span>
                          </span>
                          {#if over}
                            <span class="text-xs text-rose-400">{formatCurrency(Math.abs(remaining))} over</span>
                          {:else if pct >= 75}
                            <span class="text-xs text-amber-400">{formatCurrency(remaining)} left</span>
                          {:else}
                            <span class="text-xs text-slate-600">{formatCurrency(remaining)} left</span>
                          {/if}
                        </div>
                      </div>
                      <!-- Progress bar with optional month-progress marker -->
                      <div class="relative h-1.5 w-full rounded-full bg-[#1c2030]">
                        <div
                          class="h-1.5 rounded-full transition-all {over
                            ? 'bg-rose-500'
                            : pct >= 80
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'}"
                          style="width: {pct}%"
                        ></div>
                        <!-- Month pace marker: where we "should" be if spending were linear.
                             Intentionally non-prescriptive — rent at 100% on day 1 is fine,
                             the tick just gives visual context for variable expenses. -->
                        {#if isCurrentMonth && monthProgressPct !== null && monthProgressPct > 0 && monthProgressPct < 100}
                          <div
                            class="absolute top-0 bottom-0 w-px rounded-full bg-slate-400/50"
                            style="left: calc({monthProgressPct}% - 0.5px)"
                            title="{monthProgressPct}% of the month elapsed"
                          ></div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>

<!-- Desktop modal -->
{#if showModal}
  <button class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-label="Close modal" onclick={closeModal}
  ></button>

  <div
    class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="rounded-xl border border-[#252a3a] bg-[#13161e] shadow-2xl">
      <div class="flex items-center justify-between border-b border-[#252a3a] px-5 py-4">
        <h2 id="modal-title" class="font-semibold text-slate-100">
          {editingPlan ? "Edit budget" : "New budget"}
        </h2>
        <button
          onclick={closeModal}
          class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="p-5">
        {#if editingPlan}
          <BudgetPlanForm
            {expenseCategories}
            editPlan={editingPlan}
            onupdated={handlePlanUpdated}
            oncancel={closeModal}
          />
        {:else}
          <BudgetPlanForm {expenseCategories} oncreated={handlePlanCreated} oncancel={closeModal} />
        {/if}
      </div>
    </div>
  </div>
{/if}
