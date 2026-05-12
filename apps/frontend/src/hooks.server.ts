import type { Handle } from "@sveltejs/kit";
import { resolveAuthSession } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
  const { auth, setCookieHeaders } = await resolveAuthSession(event.request.headers.get("cookie"));
  event.locals.auth = auth;

  const response = await resolve(event);

  for (const setCookieHeader of setCookieHeaders) {
    response.headers.append("set-cookie", setCookieHeader);
  }

  return response;
};