<svelte:options runes={true} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { ArrowLeft } from "lucide-svelte";
  import BudgetPlanForm from "$lib/components/BudgetPlanForm.svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

  const allCategories = $derived<FinanceCategory[]>(page.data.allCategories ?? []);

  function handleCreated(_plan: BudgetPlan) {
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
    <h1 class="text-xl font-semibold text-slate-100">New budget</h1>
    <p class="mt-1 text-sm text-slate-400">Give your budget a name and add category limits.</p>
  </div>

  <BudgetPlanForm categories={allCategories} oncreated={handleCreated} oncancel={handleCancel} />
</div>
