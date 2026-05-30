import type { PageServerLoad } from "./$types";
import { httpGetTransactions, httpGetTransactionSummaries } from "$lib/requests/transactions";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { getMonthKey, getPreviousMonthKey } from "$lib/utils/date";

export const load: PageServerLoad = async ({ locals, url }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = url.searchParams.get("month") || getMonthKey(new Date());
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const previousMonth = getPreviousMonthKey(month);

  const transactionsParams = new URLSearchParams({ month, page: String(page), pageSize: "12" });

  const [pagedTransactions, budgetPlans, summaries] = await Promise.all([
    httpGetTransactions(transactionsParams, headers),
    httpGetBudgetPlans(headers),
    httpGetTransactionSummaries(month, previousMonth, headers),
  ]);

  return {
    pagedTransactions: pagedTransactions ?? null,
    currentMonthSummary: summaries?.current ?? null,
    previousMonthSummary: summaries?.previous ?? null,
    txMonth: month,
    txPage: page,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
  };
};
