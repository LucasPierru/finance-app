import { api, API_BASE } from './api';
import type { RegisterProfile, User } from '@finance-app/shared-types';

// These need the raw Response to inspect Set-Cookie headers in $lib/server/auth.ts
export const httpGetAuthMe = (init?: RequestInit): Promise<Response> =>
  fetch(`${API_BASE}/api/auth/me`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
  });

export const httpPostAuthRefresh = (init?: RequestInit): Promise<Response> =>
  fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as object) },
  });

export const httpGetCurrentUser = (): Promise<{ user: User }> =>
  api.get('/api/auth/me');

export const httpPostAuthRequestCode = (email: string): Promise<void> =>
  api.post('/api/auth/request-code', { email });

export const httpPostAuthVerifyCode = (email: string, code: string): Promise<{ user?: User }> =>
  api.post('/api/auth/verify-code', { email, code });

export const httpPostAuthRegister = (profile: RegisterProfile): Promise<void> =>
  api.post('/api/auth/register', {
    email: profile.email.trim().toLowerCase(),
    name: profile.name.trim(),
    birthDate: profile.dateOfBirth,
    phone: profile.phoneNumber.trim(),
  });

export async function httpPostAuthLogout(): Promise<void> {
  await api.post('/api/auth/logout').catch(() => undefined);
}
