import { browser } from '$app/environment';

const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000').replace(/\/$/, '');

// Exported for the raw-response auth functions that need to forward cookies server-side
export const API_BASE = BASE;

type Opts = Omit<RequestInit, 'body' | 'method'>;

async function apiFetch<T>(path: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
  const { body, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  const serialized = body != null ? JSON.stringify(body) : undefined;
  if (serialized && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, {
    ...(browser ? { credentials: 'include', cache: 'no-store' } : {}),
    ...rest,
    headers,
    ...(serialized !== undefined ? { body: serialized } : {}),
  });

  if (!res.ok) {
    const { message } = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(message ?? `Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  get:    <T>(path: string, opts?: Opts): Promise<T>      => apiFetch(path, opts),
  post:   <T>(path: string, body?: unknown, opts?: Opts): Promise<T> => apiFetch(path, { method: 'POST',   body, ...opts }),
  put:    <T>(path: string, body?: unknown, opts?: Opts): Promise<T> => apiFetch(path, { method: 'PUT',    body, ...opts }),
  patch:  <T>(path: string, body?: unknown, opts?: Opts): Promise<T> => apiFetch(path, { method: 'PATCH',  body, ...opts }),
  delete: <T = void>(path: string, opts?: Opts): Promise<T>          => apiFetch(path, { method: 'DELETE', ...opts }),
};
