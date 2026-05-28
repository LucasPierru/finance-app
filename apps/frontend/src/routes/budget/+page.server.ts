import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { httpGetFinanceCategories } from "$lib/requests/finance";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [financeData, budgetPlans, categories] = await Promise.all([
    loadFinancePageData(accessToken),
    httpGetBudgetPlans(headers) ?? [],
    httpGetFinanceCategories(headers) ?? [],
  ]);

  return {
    ...financeData,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
    expenseCategories: Array.isArray(categories)
      ? categories.filter((c) => c.type === "expense")
      : [],
  };
};

