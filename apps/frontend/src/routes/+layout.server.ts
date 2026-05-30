import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { loadFinancePageData } from "$lib/server/page-data";

export const load: LayoutServerLoad = async ({ url, locals, depends }) => {
  const pathname = url.pathname;
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isAuthenticated = locals.auth.authenticated;

  if (!isAuthenticated && !isAuthRoute) {
    throw redirect(303, "/login");
  }

  if (isAuthenticated && isAuthRoute) {
    throw redirect(303, "/");
  }

  if (!isAuthenticated) return {};

  depends("app:finance");
  return loadFinancePageData(locals.auth.accessToken);
};