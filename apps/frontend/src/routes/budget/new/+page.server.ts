import type { PageServerLoad } from "./$types";
import { fetchBackendJson } from "$lib/server/backend";
import type { FinanceCategory } from "@finance-app/shared-types";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const categories = await fetchBackendJson<FinanceCategory[]>("/api/finance/categories", { headers });

  return {
    expenseCategories: Array.isArray(categories) ? categories.filter((c) => c.type === "expense") : [],
  };
};
