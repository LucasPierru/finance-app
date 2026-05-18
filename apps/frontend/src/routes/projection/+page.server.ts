import type { PageServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";

export const load: PageServerLoad = async ({ locals }) =>
  loadFinancePageData(locals.auth.accessToken);