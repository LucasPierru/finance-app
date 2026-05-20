import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { fetchBackendJson } from "$lib/server/backend";
import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [plans, categories] = await Promise.all([
    fetchBackendJson<BudgetPlan[]>("/api/budget/plans", { headers }),
    fetchBackendJson<FinanceCategory[]>("/api/finance/categories", { headers }),
  ]);

  const plan = Array.isArray(plans) ? plans.find((p) => p.id === params.id) : undefined;
  if (!plan) {
    throw error(404, "Budget plan not found");
  }

  return {
    plan,
    expenseCategories: Array.isArray(categories) ? categories.filter((c) => c.type === "expense") : [],
  };
};
