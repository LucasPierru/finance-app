import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { httpGetFinanceCategories } from "$lib/requests/finance";

export const load: PageServerLoad = async ({ locals, params }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [plans, categories] = await Promise.all([
    httpGetBudgetPlans(headers),
    httpGetFinanceCategories(headers),
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
