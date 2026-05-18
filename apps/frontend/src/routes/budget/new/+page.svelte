<svelte:options runes={true} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import BudgetPlanForm from "$lib/components/BudgetPlanForm.svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

  const expenseCategories = $derived<FinanceCategory[]>(page.data.expenseCategories ?? []);

  function handleCreated(_plan: BudgetPlan) {
    goto("/budget");
  }

  function handleCancel() {
    goto("/budget");
  }
</script>

<div class="animate-fade-up mx-auto max-w-lg space-y-6 px-4 py-6">
  <!-- Back link -->
  <a href="/budget" class="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
    Back to budgets
  </a>

  <div>
    <h1 class="text-xl font-semibold text-slate-100">New budget</h1>
    <p class="mt-1 text-sm text-slate-400">Give your budget a name and add category limits.</p>
  </div>

  <BudgetPlanForm {expenseCategories} oncreated={handleCreated} oncancel={handleCancel} />
</div>
