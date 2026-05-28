import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { httpGetTransactions, httpGetTransactionSummary } from "$lib/requests/transactions";
import { httpGetBudgetPlans } from "$lib/requests/budget";
import { getMonthKey, getPriorMonthKey } from "$lib/utils/date";

export const load: PageServerLoad = async ({ locals, url }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = url.searchParams.get("month") || getMonthKey(new Date());
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const transactionsParams = new URLSearchParams({ month, page: String(page), pageSize: "12" });
  const priorMonth = getPriorMonthKey(month);

  const [financePageData, pagedTransactions, budgetPlans, currentMonthSummary, priorMonthSummary] = await Promise.all([
    loadFinancePageData(accessToken),
    httpGetTransactions(transactionsParams, headers),
    httpGetBudgetPlans(headers),
    httpGetTransactionSummary(new URLSearchParams({ month }), headers),
    httpGetTransactionSummary(new URLSearchParams({ month: priorMonth }), headers),
  ]);

  return {
    ...financePageData,
    pagedTransactions: pagedTransactions ?? null,
    currentMonthSummary: currentMonthSummary ?? null,
    priorMonthSummary: priorMonthSummary ?? null,
    txMonth: month,
    txPage: page,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
  };
};