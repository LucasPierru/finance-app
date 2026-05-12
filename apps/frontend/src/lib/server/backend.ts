export function getBackendApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

export async function fetchBackendJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBackendResponse(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}