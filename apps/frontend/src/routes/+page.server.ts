import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { fetchBackendJson } from "$lib/server/backend";
import type { BudgetPlan, PagedTransactionsResult } from "@finance-app/shared-types";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = url.searchParams.get("month") || currentMonthKey();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const txParams = new URLSearchParams({ month, page: String(page), pageSize: "12" });

  const [financePageData, pagedTransactions, budgetPlans] = await Promise.all([
    loadFinancePageData(accessToken),
    fetchBackendJson<PagedTransactionsResult>(`/api/plaid/transactions?${txParams}`, { headers }),
    fetchBackendJson<BudgetPlan[]>("/api/budget/plans", { headers }),
  ]);

  return {
    ...financePageData,
    pagedTransactions: pagedTransactions ?? null,
    txMonth: month,
    txPage: page,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
  };
};