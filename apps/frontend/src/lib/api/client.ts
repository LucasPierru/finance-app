const fallbackApiBaseUrl = "http://localhost:4000";
let refreshSessionPromise: Promise<boolean> | null = null;

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  noRetry?: boolean;
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? fallbackApiBaseUrl).replace(/\/$/, "");
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function parseResponseBody<T>(response: Response): Promise<{ message?: string } & T> {
  return (await response.json().catch(() => ({}))) as { message?: string } & T;
}

async function requestRefreshSession(): Promise<boolean> {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/refresh"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshSessionPromise = null;
    }
  })();

  return refreshSessionPromise;
}

export async function apiRequest<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  async function executeRequest(options?: ApiRequestOptions): Promise<Response> {
    const headers = new Headers(options?.headers);
    const hasBody = options?.body !== undefined && options.body !== null;

    if (hasBody && !(options?.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      ...options,
      headers,
    });
  }

  let response = await executeRequest(init);

  if (
    response.status === 401 &&
    !init?.skipAuth &&
    !init?.noRetry &&
    !path.startsWith("/api/auth/")
  ) {
    const refreshed = await requestRefreshSession();

    if (refreshed) {
      response = await executeRequest({ ...init, noRetry: true });
    }
  }

  const body = await parseResponseBody<T>(response);

  if (!response.ok) {
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }

  return body;
}