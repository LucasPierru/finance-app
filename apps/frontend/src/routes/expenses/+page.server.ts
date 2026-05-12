import type { PageServerLoad } from "./$types";
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

function normalizeEntry(entry: FinanceEntry, index: number): FinanceStatePayload["revenues"][number] {
  const amount = Number(entry.amount);
  const category = (entry.categoryName ?? entry.category ?? "Uncategorized").trim() || "Uncategorized";

  return {
    id: entry.id ?? `entry-${index}`,
    name: (entry.name ?? "Untitled").trim() || "Untitled",
    category,
    categoryId: entry.categoryId,
    amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
    rawAmount: String(entry.rawAmount ?? entry.amount ?? "0").trim() || "0",
    frequency: isEntryFrequency(entry.frequency) ? entry.frequency : "monthly",
  };
}

function pickEntries(payload: unknown): FinanceEntry[] {
  if (Array.isArray(payload)) {
    return payload as FinanceEntry[];
  }

  if (!isObject(payload)) {
    return [];
  }

  if (
    typeof payload.type === "string" &&
    typeof payload.name === "string" &&
    (payload.amount === undefined || typeof payload.amount === "number")
  ) {
    return [payload as FinanceEntry];
  }

  if (Array.isArray(payload.entries)) {
    return payload.entries as FinanceEntry[];
  }

  if (Array.isArray(payload.data)) {
    return payload.data as FinanceEntry[];
  }

  return [];
}

function splitEntries(entries: FinanceEntry[]): Pick<FinanceStatePayload, "revenues" | "costs"> {
  const revenues: FinanceStatePayload["revenues"] = [];
  const costs: FinanceStatePayload["costs"] = [];

  entries.forEach((entry, index) => {
    const normalizedEntry = normalizeEntry(entry, index);
    const normalizedType = String(entry.type ?? "").toLowerCase();

    if (normalizedType === "income" || normalizedType === "revenue") {
      revenues.push(normalizedEntry);
      return;
    }

    if (normalizedType === "expense" || normalizedType === "cost") {
      costs.push(normalizedEntry);
      return;
    }

    costs.push(normalizedEntry);
  });

  return { revenues, costs };
}

export const load: PageServerLoad = async ({ request }) => {
  const cookieHeader = request.headers.get("cookie");
  const headers = cookieHeader ? { cookie: cookieHeader } : undefined;

  const entriesResponse = await fetchBackendJson<unknown>("/api/finance/entries", { headers });

  const { revenues, costs } = splitEntries(pickEntries(entriesResponse));
  const initialFinanceState: FinanceStatePayload = {
    revenues,
    costs,
    investmentSettings: defaultInvestmentSettings,
  };

  return {
    initialFinanceState,
  };
};