import type { AuthUser } from "$lib/types/auth";
import type { User } from "@finance-app/shared-types";
import { fetchBackendResponse } from "$lib/server/backend";

type BackendAuthUser = User;

export interface AuthSession {
  authenticated: boolean;
  accessToken: null;
  user: AuthUser | null;
}

export interface AuthSessionResolution {
  auth: AuthSession;
  setCookieHeaders: string[];
}

function unauthenticated(): AuthSession {
  return {
    authenticated: false,
    accessToken: null,
    user: null,
  };
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name || valueParts.length === 0) continue;
    cookies.set(name, valueParts.join("="));
  }

  return cookies;
}

function serializeCookies(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function extractCookiePairsFromSetCookie(setCookieHeader: string): Array<[string, string]> {
  const firstSegment = setCookieHeader.split(";")[0]?.trim();
  if (!firstSegment) return [];

  const separatorIndex = firstSegment.indexOf("=");
  if (separatorIndex <= 0) return [];

  const name = firstSegment.slice(0, separatorIndex);
  const value = firstSegment.slice(separatorIndex + 1);

  return [[name, value]];
}

function getSetCookieHeaders(response: Response): string[] {
  const headersWithSetCookie = response.headers as Headers & { getSetCookie?: () => string[] };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

async function fetchCurrentUser(cookieHeader: string): Promise<BackendAuthUser | null> {
  const meResponse = await fetchBackendResponse("/api/auth/me", {
    method: "GET",
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!meResponse.ok) {
    return null;
  }

  const payload = (await meResponse.json().catch(() => ({}))) as { user?: BackendAuthUser };
  return payload.user ?? null;
}

function toAuthUser(user: BackendAuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    dateOfBirth: user.birthDate,
    phoneNumber: user.phone,
  };
}

export async function resolveAuthSession(cookieHeader: string | null): Promise<AuthSessionResolution> {
  if (!cookieHeader) {
    return {
      auth: unauthenticated(),
      setCookieHeaders: [],
    };
  }

  const directUser = await fetchCurrentUser(cookieHeader);
  if (directUser) {
    return {
      auth: {
        authenticated: true,
        accessToken: null,
        user: toAuthUser(directUser),
      },
      setCookieHeaders: [],
    };
  }

  const refreshResponse = await fetchBackendResponse("/api/auth/refresh", {
    method: "POST",
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!refreshResponse.ok) {
    return {
      auth: unauthenticated(),
      setCookieHeaders: [],
    };
  }

  const setCookieHeaders = getSetCookieHeaders(refreshResponse);
  const existingCookies = parseCookieHeader(cookieHeader);

  for (const setCookieHeader of setCookieHeaders) {
    for (const [name, value] of extractCookiePairsFromSetCookie(setCookieHeader)) {
      existingCookies.set(name, value);
    }
  }

  const refreshedCookieHeader = serializeCookies(existingCookies);
  const refreshedUser = await fetchCurrentUser(refreshedCookieHeader);

  if (!refreshedUser) {
    return {
      auth: unauthenticated(),
      setCookieHeaders,
    };
  }

  return {
    auth: {
      authenticated: true,
      accessToken: null,
      user: toAuthUser(refreshedUser),
    },
    setCookieHeaders,
  };
}