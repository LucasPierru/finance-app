import type { BankAccount, BankTransaction } from "$lib/types/banking";

interface UserBankState {
  accessToken: string;
  itemId: string;
  institutionName: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
  transactions: BankTransaction[];
}

const GLOBAL_KEY = "__WEALTHFLOW_BANK_STORE__";

function getGlobalStore(): Map<string, UserBankState> {
  const globalObj = globalThis as Record<string, unknown>;
  if (!globalObj[GLOBAL_KEY]) {
    globalObj[GLOBAL_KEY] = new Map<string, UserBankState>();
  }
  return globalObj[GLOBAL_KEY] as Map<string, UserBankState>;
}

const bankStore = getGlobalStore();

export function getUserBankState(userId: string): UserBankState | null {
  return bankStore.get(userId) ?? null;
}

export function saveUserBankState(userId: string, state: UserBankState): void {
  bankStore.set(userId, state);
}

export function patchUserBankState(userId: string, patch: Partial<UserBankState>): UserBankState | null {
  const existing = bankStore.get(userId);
  if (!existing) return null;

  const next = { ...existing, ...patch };
  bankStore.set(userId, next);
  return next;
}

export function clearUserBankState(userId: string): void {
  bankStore.delete(userId);
}

export type { UserBankState };
