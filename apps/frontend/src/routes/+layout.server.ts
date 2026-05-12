import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ url, locals }) => {
  const pathname = url.pathname;
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isAuthenticated = locals.auth.authenticated;

  if (!isAuthenticated && !isAuthRoute) {
    throw redirect(303, "/login");
  }

  if (isAuthenticated && isAuthRoute) {
    throw redirect(303, "/");
  }
};