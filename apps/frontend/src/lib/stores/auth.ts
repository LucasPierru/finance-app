import { writable } from "svelte/store";
import { apiRequest } from "$lib/api/client";
import type { User } from "@finance-app/shared-types";
import type { AuthUser, RegisterProfile } from "$lib/types/auth";

type BackendAuthUser = User;

function normalizeAuthUser(user: BackendAuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    dateOfBirth: user.birthDate,
    phoneNumber: user.phone,
  };
}

interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  initialized: false,
  authenticated: false,
  user: null,
  loading: false,
  error: null,
};

const authState = writable<AuthState>(initialState);

export { authState };

function setLoading(loading: boolean) {
  authState.update((state) => ({ ...state, loading }));
}

function setError(error: string | null) {
  authState.update((state) => ({ ...state, error }));
}

function clearTokens() {
}

function applyAuthenticatedUser(user: AuthUser) {
  authState.update((state) => ({
    ...state,
    authenticated: true,
    user,
    loading: false,
    error: null,
    initialized: true,
  }));
}

function applyLoggedOutState() {
  authState.update((state) => ({
    ...state,
    authenticated: false,
    user: null,
    loading: false,
    error: null,
    initialized: true,
  }));
}

async function loadCurrentUser(): Promise<AuthUser> {
  const payload = await apiRequest<{ user: BackendAuthUser }>("/api/auth/me", { method: "GET" });
  return normalizeAuthUser(payload.user);
}

export async function initializeAuth(): Promise<void> {
  setLoading(true);

  try {
    const user = await loadCurrentUser();
    applyAuthenticatedUser(user);
  } catch {
    clearTokens();
    applyLoggedOutState();
  }
}

export async function requestLoginCode(email: string): Promise<void> {
  setLoading(true);
  setError(null);

  try {
    await apiRequest<void>("/api/auth/request-code", {
      method: "POST",
      skipAuth: true,
      noRetry: true,
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not request login code";
    console.error("Error requesting login code:", message);
    setError(message);
    throw error;
  } finally {
    setLoading(false);
  }
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  setLoading(true);
  setError(null);

  try {
    const payload = await apiRequest<{ user?: BackendAuthUser }>("/api/auth/verify-code", {
      method: "POST",
      skipAuth: true,
      noRetry: true,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      }),
    });

    const user = payload.user ? normalizeAuthUser(payload.user) : await loadCurrentUser();
    applyAuthenticatedUser(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    setError(message);
    throw error;
  } finally {
    setLoading(false);
  }
}

export async function requestRegistrationCode(profile: RegisterProfile): Promise<void> {
  setLoading(true);
  setError(null);

  try {
    await apiRequest<void>("/api/auth/register", {
      method: "POST",
      skipAuth: true,
      noRetry: true,
      body: JSON.stringify({
        email: profile.email.trim().toLowerCase(),
        name: profile.name.trim(),
        birthDate: profile.dateOfBirth,
        phone: profile.phoneNumber.trim(),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not request registration code";
    setError(message);
    throw error;
  } finally {
    setLoading(false);
  }
}

export async function verifyRegistrationCode(profile: RegisterProfile, code: string): Promise<void> {
  return verifyLoginCode(profile.email, code);
}

export async function logout(): Promise<void> {
  setLoading(true);

  try {
    await apiRequest<void>("/api/auth/logout", {
      method: "POST",
      skipAuth: true,
      noRetry: true,
    }).catch(() => undefined);
  } finally {
    clearTokens();
    applyLoggedOutState();
    setLoading(false);
  }
}