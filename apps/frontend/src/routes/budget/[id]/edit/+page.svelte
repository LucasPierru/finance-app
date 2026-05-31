<svelte:options runes={true} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { ArrowLeft } from "lucide-svelte";
  import BudgetPlanForm from "$lib/components/BudgetPlanForm.svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

  const plan = $derived<BudgetPlan>(page.data.plan);
  const allCategories = $derived<FinanceCategory[]>(page.data.allCategories ?? []);

  function handleUpdated(_plan: BudgetPlan) {
    goto("/budget");
  }

  function handleCancel() {
    goto("/budget");
  }
</script>

<div class="animate-fade-up mx-auto max-w-lg space-y-6">
  <!-- Back link -->
  <a href="/budget" class="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200">
    <ArrowLeft class="h-4 w-4" />
    Back to budgets
  </a>

  <div>
    <h1 class="text-xl font-semibold text-slate-100">Edit budget</h1>
    <p class="mt-1 text-sm text-slate-400">Update the name and category limits for this budget.</p>
  </div>

  <BudgetPlanForm categories={allCategories} editPlan={plan} onupdated={handleUpdated} oncancel={handleCancel} />
</div>
