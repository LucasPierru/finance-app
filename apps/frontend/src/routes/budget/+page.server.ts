import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { httpGetFinanceCategories } from "$lib/requests/finance";
import { httpGetTransactionSummary } from "$lib/requests/transactions";
import { getMonthKey } from "$lib/utils/date";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = getMonthKey(new Date());

  const [financeData, budgetPlans, categories, currentMonthSummary] = await Promise.all([
    loadFinancePageData(accessToken),
    httpGetBudgetPlans(headers) ?? [],
    httpGetFinanceCategories(headers) ?? [],
    httpGetTransactionSummary(new URLSearchParams({ month }), headers),
  ]);

  return {
    ...financeData,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
    expenseCategories: Array.isArray(categories)
      ? categories.filter((c) => c.type === "expense")
      : [],
    currentMonthSummary: currentMonthSummary ?? null,
  };
};

