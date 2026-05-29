import { derived, writable } from "svelte/store";
import { invalidateAll } from "$app/navigation";
import { httpGetPlaidState, httpPostPlaidLinkToken, httpPostPlaidExchangePublicToken, httpPostPlaidSync, httpDeletePlaidConnection } from "$lib/requests/plaid";
import type { BankConnectionState } from "@finance-app/shared-types";

const initialState: BankConnectionState = {
  connected: false,
  connections: [],
  institutionName: null,
  lastSyncAt: null,
  accounts: [],
  recentTransactions: [],
};

export const bankState = writable<BankConnectionState>(initialState);
export const bankLoading = writable<boolean>(false);
export const bankError = writable<string | null>(null);
export const bankIsSynced = derived(bankState, ($bankState) =>
  Boolean($bankState.connected && $bankState.lastSyncAt),
);
export const bankHasSyncedData = derived(
  bankState,
  ($bankState) =>
    Boolean(
      $bankState.connected &&
      $bankState.lastSyncAt &&
      ($bankState.accounts.length > 0 || $bankState.recentTransactions.length > 0),
    ),
);

export interface CategorizedBankTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  isoCurrencyCode: string | null;
  category: string[];
  pending: boolean;
  resolvedCategory: string;
  flow: "income" | "expense";
  merchantKey: string;
}

export interface RecurringBankEntry {
  merchantKey: string;
  displayName: string;
  resolvedCategory: string;
  flow: "income" | "expense";
  occurrences: number;
  averageAmount: number;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly";
  lastSeenDate: string;
}

const categoryKeywordMap: Array<{ category: string; keywords: string[] }> = [
  { category: "Housing", keywords: ["rent", "mortgage", "landlord", "property"] },
  { category: "Utilities", keywords: ["electric", "water", "gas", "internet", "phone", "utility"] },
  { category: "Food", keywords: ["grocery", "market", "restaurant", "coffee", "uber eats", "doordash"] },
  { category: "Transport", keywords: ["fuel", "gas station", "uber", "lyft", "metro", "transit"] },
  { category: "Insurance", keywords: ["insurance", "insure"] },
  { category: "Health", keywords: ["pharmacy", "clinic", "hospital", "medical", "dental"] },
  { category: "Shopping", keywords: ["amazon", "store", "shop", "retail"] },
  { category: "Entertainment", keywords: ["netflix", "spotify", "cinema", "game", "streaming"] },
  { category: "Salary", keywords: ["salary", "payroll", "paycheck", "deposit"] },
  { category: "Investments", keywords: ["dividend", "interest", "brokerage"] },
  { category: "Benefits", keywords: ["benefit", "refund", "rebate"] },
];

function normalizeMerchantKey(transaction: BankConnectionState["recentTransactions"][number]): string {
  return (transaction.merchantName || transaction.name || "Unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function resolveCategory(transaction: BankConnectionState["recentTransactions"][number]): string {
  if (transaction.category.length > 0 && transaction.category[0]) return transaction.category[0];

  const haystack = `${transaction.name} ${transaction.merchantName ?? ""}`.toLowerCase();
  const matched = categoryKeywordMap.find((entry) => entry.keywords.some((keyword) => haystack.includes(keyword)));
  if (matched) return matched.category;

  return transaction.flow === "income" ? "Income" : "Expense";
}

function toCategorized(transaction: BankConnectionState["recentTransactions"][number]): CategorizedBankTransaction {
  return {
    ...transaction,
    resolvedCategory: resolveCategory(transaction),
    flow: transaction.flow,
    merchantKey: normalizeMerchantKey(transaction),
  };
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  const mean = average(numbers);
  const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

function detectCadence(avgGapDays: number): RecurringBankEntry["cadence"] | null {
  if (avgGapDays >= 5 && avgGapDays <= 10) return "weekly";
  if (avgGapDays >= 11 && avgGapDays <= 18) return "biweekly";
  if (avgGapDays >= 20 && avgGapDays <= 40) return "monthly";
  if (avgGapDays >= 70 && avgGapDays <= 110) return "quarterly";
  return null;
}

export const categorizedBankTransactions = derived(bankState, ($bankState): CategorizedBankTransaction[] =>
  $bankState.recentTransactions
    .filter((transaction) => !transaction.pending)
    .map(toCategorized)
    .sort((a, b) => b.date.localeCompare(a.date)),
);

export const recurringBankEntries = derived(categorizedBankTransactions, ($transactions): RecurringBankEntry[] => {
  const grouped = new Map<string, CategorizedBankTransaction[]>();

  for (const transaction of $transactions) {
    const key = `${transaction.merchantKey}::${transaction.flow}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  const recurring: RecurringBankEntry[] = [];

  for (const [key, bucket] of grouped.entries()) {
    if (bucket.length < 2) continue;

    const sortedByDate = [...bucket].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sortedByDate.map((transaction) => Math.abs(transaction.amount));
    const avgAmount = average(amounts);
    if (avgAmount <= 0) continue;

    const amountDeviationRatio = standardDeviation(amounts) / avgAmount;
    if (amountDeviationRatio > 0.35) continue;

    const dateDiffs: number[] = [];
    for (let index = 1; index < sortedByDate.length; index += 1) {
      const previous = new Date(sortedByDate[index - 1].date);
      const current = new Date(sortedByDate[index].date);
      const diffInDays = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
      if (diffInDays > 0) dateDiffs.push(diffInDays);
    }

    if (dateDiffs.length === 0) continue;

    const cadence = detectCadence(average(dateDiffs));
    if (!cadence) continue;

    const latest = sortedByDate[sortedByDate.length - 1];

    recurring.push({
      merchantKey: key,
      displayName: latest.merchantName || latest.name,
      resolvedCategory: latest.resolvedCategory,
      flow: latest.flow,
      occurrences: sortedByDate.length,
      averageAmount: avgAmount,
      cadence,
      lastSeenDate: latest.date,
    });
  }

  return recurring.sort((a, b) => b.averageAmount - a.averageAmount);
});

function inferCountryFromLocale(): string | null {
  if (typeof navigator === "undefined") return null;

  const locales = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);

  for (const locale of locales) {
    const parts = locale.split("-");
    const region = parts[parts.length - 1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) {
      return region;
    }
  }

  return null;
}

function inferCountryFromTimeZone(): string | null {
  if (typeof Intl === "undefined") return null;

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return null;

  // Lightweight fallback when locale has no region.
  const timeZoneMap: Record<string, string> = {
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "Europe/London": "GB",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "Europe/Madrid": "ES",
    "Europe/Amsterdam": "NL",
    "Europe/Rome": "IT",
    "Europe/Brussels": "BE",
    "Europe/Dublin": "IE",
    "Australia/Sydney": "AU",
    "Australia/Melbourne": "AU",
  };

  return timeZoneMap[zone] ?? null;
}

export function inferUserCountryCode(): string {
  return inferCountryFromLocale() ?? inferCountryFromTimeZone() ?? "US";
}

export async function fetchBankState() {
  bankLoading.set(true);
  bankError.set(null);

  try {
    const state = await httpGetPlaidState();
    bankState.set(state);

    if (state.connected && !state.lastSyncAt) {
      await syncBankData();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load bank state";
    bankError.set(message);
  } finally {
    bankLoading.set(false);
  }
}

export async function createPlaidLinkToken(countryCode?: string): Promise<string> {
  bankError.set(null);
  const resolvedCountryCode = countryCode?.trim().toUpperCase() || inferUserCountryCode();
  const data = await httpPostPlaidLinkToken(resolvedCountryCode);
  return data.linkToken;
}

export async function exchangePublicToken(publicToken: string, institutionName: string | null) {
  bankLoading.set(true);
  bankError.set(null);

  try {
    const payload = await httpPostPlaidExchangePublicToken(publicToken, institutionName);
    bankState.set(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bank connection failed";
    bankError.set(message);
    bankLoading.set(false);
    throw error;
  } finally {
    bankLoading.set(false);
  }
}

export async function syncBankData() {
  bankLoading.set(true);
  bankError.set(null);

  try {
    const payload = await httpPostPlaidSync();
    bankState.set(payload);
    await invalidateAll();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bank sync failed";
    bankError.set(message);
    throw error;
  } finally {
    bankLoading.set(false);
  }
}

export async function disconnectBank(itemId: string) {
  bankLoading.set(true);
  bankError.set(null);

  try {
    await httpDeletePlaidConnection(itemId);
    const state = await httpGetPlaidState();
    bankState.set(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not disconnect account";
    bankError.set(message);
    throw error;
  } finally {
    bankLoading.set(false);
  }
}

export function hydrateBankState(state: BankConnectionState | null | undefined): void {
  if (!state) {
    bankState.set(initialState);
    return;
  }

  bankState.set(state);
}
