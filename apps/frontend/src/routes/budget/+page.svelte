<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { emptyBankState, emptyFinanceState, getEffectiveFinanceView } from "$lib/utils/finance-view";
  import { apiRequest } from "$lib/api/client";
  import BudgetPlanForm from "$lib/components/BudgetPlanForm.svelte";
  import BudgetBarChart from "$lib/components/BudgetBarChart.svelte";
  import BudgetDonutChart from "$lib/components/BudgetDonutChart.svelte";
  import type { BudgetPlan, BudgetPlanItem, FinanceCategory } from "@finance-app/shared-types";

  type Period = "weekly" | "monthly" | "yearly";

  const financeState = $derived(page.data.initialFinanceState ?? emptyFinanceState);
  const bankState = $derived(page.data.initialBankState ?? emptyBankState);
  const allCategories = $derived(page.data.allCategories ?? []);
  const financeView = $derived(getEffectiveFinanceView(financeState, bankState, allCategories));

  const monthlyIncome = $derived(financeView.totalRevenue);
  const monthlyExpenses = $derived(financeView.totalCosts);
  const monthlySurplus = $derived(financeView.monthlySurplus);

  let budgetPlans = $state<BudgetPlan[]>(page.data.budgetPlans ?? []);
  const expenseCategories = $derived<FinanceCategory[]>(page.data.expenseCategories ?? []);

  let selectedPlanId = $state<string | null>(null);
  const selectedPlan = $derived(budgetPlans.find((p) => p.id === selectedPlanId) ?? budgetPlans[0] ?? null);

  $effect(() => {
    if (budgetPlans.length > 0 && (selectedPlanId === null || !budgetPlans.find((p) => p.id === selectedPlanId))) {
      selectedPlanId = budgetPlans[0].id;
    }
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
      await apiRequest(`/api/budget/plans/${planId}`, { method: "DELETE" });
      budgetPlans = budgetPlans.filter((p) => p.id !== planId);
    } catch {
      // ignore
    }
  }

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function toMonthly(amount: number, period: Period): number {
    if (period === "weekly") return (amount * 52) / 12;
    if (period === "yearly") return amount / 12;
    return amount;
  }

  function periodLabel(period: Period): string {
    return period === "weekly" ? "/ wk" : period === "yearly" ? "/ yr" : "/ mo";
  }

  function spentForItem(item: BudgetPlanItem): number {
    if (!item.categoryId) return 0;
    return financeView.costs.filter((c) => c.categoryId === item.categoryId).reduce((sum, c) => sum + c.amount, 0);
  }

  function itemProgress(item: BudgetPlanItem): { spent: number; monthly: number; pct: number } {
    const monthly = toMonthly(item.amount, item.period);
    const spent = spentForItem(item);
    const pct = monthly > 0 ? Math.min((spent / monthly) * 100, 100) : 0;
    return { spent, monthly, pct };
  }
</script>

<div class="animate-fade-up space-y-4 lg:space-y-6">
  <!-- Summary cards -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Monthly income</CardDescription>
        <CardTitle class="text-2xl text-emerald-400">{fmt(monthlyIncome)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Monthly expenses</CardDescription>
        <CardTitle class="text-2xl text-rose-400">{fmt(monthlyExpenses)}</CardTitle>
      </CardHeader>
    </Card>
    <Card>
      <CardHeader class="pb-2">
        <CardDescription>Available to budget</CardDescription>
        <CardTitle class="text-2xl {monthlySurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          {fmt(monthlySurplus)}
        </CardTitle>
      </CardHeader>
    </Card>
  </div>

  <!-- Budget comparison charts -->
  {#if budgetPlans.length > 0}
    {#if budgetPlans.length > 1}
      <div class="flex flex-wrap gap-2">
        {#each budgetPlans as plan (plan.id)}
          <button
            onclick={() => (selectedPlanId = plan.id)}
            class="rounded-full px-3.5 py-1 text-sm font-medium transition-colors {selectedPlanId === plan.id
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}"
          >
            {plan.name}
          </button>
        {/each}
      </div>
    {/if}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <BudgetBarChart {selectedPlan} costs={financeView.costs} />
      </div>
      <BudgetDonutChart {selectedPlan} costs={financeView.costs} />
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
        <div class="flex items-center gap-2">
          <!-- Mobile: navigate to /budget/new -->
          <a href="/budget/new" class="md:hidden">
            <Button class="gap-1.5">+ New budget</Button>
          </a>
          <!-- Desktop: open modal -->
          <Button onclick={openModal} class="hidden gap-1.5 md:inline-flex">+ New budget</Button>
        </div>
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
            <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
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
                    {@const { spent, monthly, pct } = itemProgress(item)}
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-slate-300">
                          {item.categoryName ?? "General"}
                        </span>
                        <span class="shrink-0 text-slate-400">
                          {fmt(spent)}
                          <span class="text-slate-600">/</span>
                          {fmt(item.amount)}
                          <span class="ml-1 text-xs text-slate-500">{periodLabel(item.period)}</span>
                        </span>
                      </div>
                      <div class="h-1.5 w-full rounded-full bg-slate-800">
                        <div
                          class="h-1.5 rounded-full transition-all {pct >= 100
                            ? 'bg-rose-500'
                            : pct >= 80
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'}"
                          style="width: {pct}%"
                        ></div>
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
