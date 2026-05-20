import type { BankConnectionState, FinanceCategory } from "@finance-app/shared-types";
import type { FinanceStatePayload } from "$lib/stores/finance";
import { fetchBackendJson } from "$lib/server/backend";

type EntryFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

type FinanceEntry = {
  id?: string;
  name?: string;
  category?: string;
  categoryName?: string;
  categoryId?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: EntryFrequency;
  type?: string;
};

const defaultInvestmentSettings: FinanceStatePayload["investmentSettings"] = {
  annualReturn: 7,
  years: 20,
  initialAmount: 0,
  dividendYield: 2,
  incomeGrowth: 2,
  expenseGrowth: 2,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntryFrequency(value: unknown): value is EntryFrequency {
  return value === "weekly" || value === "biweekly" || value === "monthly" || value === "yearly";
}

function normalizeEntry(entry: FinanceEntry): FinanceStatePayload["revenues"][number] {
  const amount = Number(entry.amount);
  const category = entry.categoryName ?? entry.category ?? "Uncategorized";

  return {
    id: entry.id ?? crypto.randomUUID(),
    name: (entry.name ?? "Untitled").trim() || "Untitled",
    category: category.trim() || "Uncategorized",
    categoryId: entry.categoryId,
    amount: Number.isFinite(amount) ? amount : 0,
    rawAmount: String(entry.rawAmount ?? entry.amount ?? "0").trim() || "0",
    frequency: isEntryFrequency(entry.frequency) ? entry.frequency : "monthly",
  };
}

function normalizeSettings(settings: unknown): FinanceStatePayload["investmentSettings"] {
  if (!isObject(settings)) {
    return defaultInvestmentSettings;
  }

  return {
    annualReturn: Number(settings.annualReturn ?? defaultInvestmentSettings.annualReturn),
    years: Number(settings.years ?? defaultInvestmentSettings.years),
    initialAmount: Number(settings.initialAmount ?? defaultInvestmentSettings.initialAmount),
    dividendYield: Number(settings.dividendYield ?? defaultInvestmentSettings.dividendYield),
    incomeGrowth: Number(settings.incomeGrowth ?? defaultInvestmentSettings.incomeGrowth),
    expenseGrowth: Number(settings.expenseGrowth ?? defaultInvestmentSettings.expenseGrowth),
  };
}

function pickEntries(payload: unknown): FinanceEntry[] {
  if (Array.isArray(payload)) {
    return payload as FinanceEntry[];
  }

  if (!isObject(payload)) {
    return [];
  }

  const directEntries = payload.entries;
  if (Array.isArray(directEntries)) {
    return directEntries as FinanceEntry[];
  }

  const dataEntries = payload.data;
  if (Array.isArray(dataEntries)) {
    return dataEntries as FinanceEntry[];
  }

  return [];
}

function splitEntries(entries: FinanceEntry[]): Pick<FinanceStatePayload, "revenues" | "costs"> {
  const revenues: FinanceStatePayload["revenues"] = [];
  const costs: FinanceStatePayload["costs"] = [];

  for (const entry of entries) {
    const normalizedEntry = normalizeEntry(entry);
    const normalizedType = String(entry.type ?? "").toLowerCase();

    if (normalizedType === "income" || normalizedType === "revenue") {
      revenues.push(normalizedEntry);
      continue;
    }

    if (normalizedType === "expense" || normalizedType === "cost") {
      costs.push(normalizedEntry);
      continue;
    }

    if (normalizedEntry.amount < 0) {
      revenues.push({
        ...normalizedEntry,
        amount: Math.abs(normalizedEntry.amount),
      });
      continue;
    }

    costs.push(normalizedEntry);
  }

  return { revenues, costs };
}

export async function loadFinancePageData(accessToken: string | null) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [stateResponse, initialBankState, allCategories] = await Promise.all([
    fetchBackendJson<{
      revenues?: FinanceEntry[];
      costs?: FinanceEntry[];
      investmentSettings?: unknown;
    }>("/api/finance/state", { headers }),
    fetchBackendJson<BankConnectionState>("/api/plaid/state", { headers }),
    fetchBackendJson<FinanceCategory[]>("/api/finance/categories", { headers }),
  ]);

  const stateRevenues = Array.isArray(stateResponse?.revenues) ? stateResponse.revenues : [];
  const stateCosts = Array.isArray(stateResponse?.costs) ? stateResponse.costs : [];

  const initialFinanceState: FinanceStatePayload = {
    revenues: stateRevenues.map(normalizeEntry),
    costs: stateCosts.map(normalizeEntry),
    investmentSettings: normalizeSettings(stateResponse?.investmentSettings),
  };

  return {
    initialFinanceState,
    initialBankState,
    allCategories: Array.isArray(allCategories) ? allCategories : [],
  };
}