import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";
import { fetchBackendJson } from "$lib/server/backend";
import type { BudgetPlan, PagedTransactionsResult } from "@finance-app/shared-types";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPriorMonthKey(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = url.searchParams.get("month") || currentMonthKey();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const txParams = new URLSearchParams({ month, page: String(page), pageSize: "12" });
  const priorMonth = getPriorMonthKey(month);
  const priorTxParams = new URLSearchParams({ month: priorMonth, page: "1", pageSize: "1" });

  const [financePageData, pagedTransactions, budgetPlans, priorMonthTransactions] = await Promise.all([
    loadFinancePageData(accessToken),
    fetchBackendJson<PagedTransactionsResult>(`/api/plaid/transactions?${txParams}`, { headers }),
    fetchBackendJson<BudgetPlan[]>("/api/budget/plans", { headers }),
    fetchBackendJson<PagedTransactionsResult>(`/api/plaid/transactions?${priorTxParams}`, { headers }),
  ]);

  return {
    ...financePageData,
    pagedTransactions: pagedTransactions ?? null,
    priorMonthTransactions: priorMonthTransactions ?? null,
    txMonth: month,
    txPage: page,
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
  };
};