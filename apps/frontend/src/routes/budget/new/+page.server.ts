import type { PageServerLoad } from "./$types";
import { httpGetFinanceCategories } from "$lib/requests/finance";

export const load: PageServerLoad = async ({ locals }) => {
  const accessToken = locals.auth.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const categories = await httpGetFinanceCategories(headers);

  return {
    allCategories: Array.isArray(categories) ? categories : [],
  };
};
