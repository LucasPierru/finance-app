import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { fetchBackendJson } from "$lib/server/backend";
import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [financeData, budgetPlans, categories] = await Promise.all([
    loadFinancePageData(accessToken),
    fetchBackendJson<BudgetPlan[]>("/api/budget/plans", { headers }) ?? [],
    fetchBackendJson<FinanceCategory[]>("/api/finance/categories", { headers }) ?? [],
  ]);

  return {
    ...financeData,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
    expenseCategories: Array.isArray(categories)
      ? categories.filter((c) => c.type === "expense")
      : [],
  };
};

