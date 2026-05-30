import type { PageServerLoad } from "./$types";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { httpGetFinanceCategories } from "$lib/requests/finance";
import { httpGetTransactionSummary } from "$lib/requests/transactions";
import { getMonthKey } from "$lib/utils/date";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = getMonthKey(new Date());

  const [budgetPlans, categories, currentMonthSummary] = await Promise.all([
    httpGetBudgetPlans(headers) ?? [],
    httpGetFinanceCategories(headers) ?? [],
    httpGetTransactionSummary(new URLSearchParams({ month }), headers),
  ]);

  return {
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
    expenseCategories: Array.isArray(categories)
      ? categories.filter((c) => c.type === "expense")
      : [],
    currentMonthSummary: currentMonthSummary ?? null,
  };
};
