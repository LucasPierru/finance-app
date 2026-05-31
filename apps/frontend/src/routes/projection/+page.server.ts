import type { PageServerLoad } from "./$types";
import { httpGetBudgetPlans } from "$lib/requests/budget";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const budgetPlans = await httpGetBudgetPlans(headers);

  return {
    budgetPlans: Array.isArray(budgetPlans) ? budgetPlans : [],
  };
};
