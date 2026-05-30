import type { PageServerLoad } from "./$types";
import { httpGetTransactions, httpGetTransactionSummary } from "$lib/requests/transactions";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const month = url.searchParams.get("month") || currentMonthKey();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const flow = url.searchParams.get("flow") ?? "";
  const search = url.searchParams.get("search") ?? "";
  const minAmount = url.searchParams.get("minAmount") ?? "";
  const maxAmount = url.searchParams.get("maxAmount") ?? "";
  const categoryId = url.searchParams.get("categoryId") ?? "";
  const subCategoryId = url.searchParams.get("subCategoryId") ?? "";
  const sortBy = url.searchParams.get("sortBy") ?? "";
  const sortDir = url.searchParams.get("sortDir") ?? "";

  const txParams = new URLSearchParams({ month, page: String(page), pageSize: "20" });
  if (flow) txParams.set("flow", flow);
  if (search) txParams.set("search", search);
  if (minAmount) txParams.set("minAmount", minAmount);
  if (maxAmount) txParams.set("maxAmount", maxAmount);
  if (categoryId) txParams.set("categoryId", categoryId);
  if (subCategoryId) txParams.set("subCategoryId", subCategoryId);
  if (sortBy) txParams.set("sortBy", sortBy);
  if (sortDir) txParams.set("sortDir", sortDir);

  const summaryParams = new URLSearchParams({ month });
  if (flow) summaryParams.set("flow", flow);
  if (search) summaryParams.set("search", search);
  if (minAmount) summaryParams.set("minAmount", minAmount);
  if (maxAmount) summaryParams.set("maxAmount", maxAmount);
  if (categoryId) summaryParams.set("categoryId", categoryId);
  if (subCategoryId) summaryParams.set("subCategoryId", subCategoryId);

  const [pagedTransactions, txSummary] = await Promise.all([
    httpGetTransactions(txParams, headers),
    httpGetTransactionSummary(summaryParams, headers),
  ]);

  return {
    pagedTransactions: pagedTransactions ?? null,
    txSummary: txSummary ?? null,
    filters: { month, page, flow, search, minAmount, maxAmount, categoryId, subCategoryId, sortBy, sortDir },
  };
};
