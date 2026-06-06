import type { BankTransaction, TransactionSummary } from "@finance-app/shared-types";
import type { EffectiveFinanceView } from "./finance-view";
import { categorizeBankTransaction } from "./finance-view";
import { parseLocalCalendarDate, getMonthKey, formatDateLabel } from "./date";

export interface DisplayTransaction {
  id: string;
  dateValue: string;
  dateLabel: string;
  name: string;
  merchant: string;
  category: string;
  amount: number;
  isoCurrencyCode: string | null;
  flow: "income" | "expense";
  source: "bank" | "manual";
  isTransfer: boolean;
}

export interface MonthlyTransactionGroup {
  key: string;
  label: string;
  items: DisplayTransaction[];
}

export function buildSourceTransactions(financeView: EffectiveFinanceView): DisplayTransaction[] {
  if (financeView.categorizedBankTransactions.length > 0) {
    return financeView.categorizedBankTransactions
      .map((tx) => ({
        id: tx.transactionId,
        dateValue: tx.date,
        dateLabel: formatDateLabel(tx.date),
        name: tx.name,
        merchant: tx.merchantName ?? "-",
        category: tx.resolvedCategory,
        amount: Math.abs(tx.amount),
        isoCurrencyCode: tx.isoCurrencyCode,
        flow: tx.flow,
        source: "bank" as const,
        isTransfer: tx.isTransfer,
      }))
      .sort((a, b) => b.dateValue.localeCompare(a.dateValue));
  }

  const monthDate = new Date();
  const currentMonthDateValue = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;

  return [
    ...financeView.costs.map((cost) => ({
      id: `manual-expense-${cost.id}`,
      dateValue: currentMonthDateValue,
      dateLabel: "Manual month entry",
      name: cost.name,
      merchant: "Manual",
      category: cost.category || "Other",
      amount: Math.abs(cost.amount),
      isoCurrencyCode: null,
      flow: "expense" as const,
      source: "manual" as const,
      isTransfer: false,
    })),
    ...financeView.revenues.map((revenue) => ({
      id: `manual-income-${revenue.id}`,
      dateValue: currentMonthDateValue,
      dateLabel: "Manual month entry",
      name: revenue.name,
      merchant: "Manual",
      category: revenue.category || "Other",
      amount: Math.abs(revenue.amount),
      isoCurrencyCode: null,
      flow: "income" as const,
      source: "manual" as const,
      isTransfer: false,
    })),
  ];
}

export function groupTransactionsByMonth(items: DisplayTransaction[]): MonthlyTransactionGroup[] {
  const groups = new Map<string, MonthlyTransactionGroup>();

  for (const item of items) {
    const parsed = parseLocalCalendarDate(item.dateValue);
    if (!parsed) continue;

    const key = getMonthKey(parsed);
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, {
        key,
        label: parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        items: [item],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function buildDailyExpenseTrend(
  monthKey: string,
  serverDaily: Array<{ date: string; totalAmount: number }> | undefined,
  fallbackItems: DisplayTransaction[],
): number[] {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  const daysCount = match ? new Date(Number(match[1]), Number(match[2]), 0).getDate() : 31;
  const days = new Array(daysCount).fill(0) as number[];

  if (serverDaily && serverDaily.length > 0) {
    for (const entry of serverDaily) {
      const d = parseLocalCalendarDate(entry.date);
      if (!d) continue;
      const idx = d.getDate() - 1;
      if (idx >= 0 && idx < days.length) days[idx] += entry.totalAmount;
    }
  } else {
    for (const item of fallbackItems) {
      if (item.flow !== "expense" || item.isTransfer) continue;
      const parsed = parseLocalCalendarDate(item.dateValue);
      if (!parsed) continue;
      const idx = parsed.getDate() - 1;
      if (idx >= 0 && idx < days.length) days[idx] += item.amount;
    }
  }

  return days;
}

export interface MonthSummary {
  expenseBreakdown: { labels: string[]; values: number[]; total: number };
  revenueTotal: number;
  delta: number;
  transferCount: number;
  expenseTransactionCount: number;
}

export function buildMonthSummary(
  serverSummary: TransactionSummary | null | undefined,
  items: DisplayTransaction[],
  pagedTotal: number | undefined,
): MonthSummary {
  const breakdown = serverSummary?.categoryBreakdown;
  const expenseBreakdown =
    breakdown && breakdown.length > 0
      ? {
          labels: breakdown.map((e) => e.category),
          values: breakdown.map((e) => e.totalAmount),
          total: serverSummary!.totalExpenses,
        }
      : (() => {
          const byCategory = new Map<string, number>();
          for (const item of items) {
            if (item.flow !== "expense" || item.isTransfer) continue;
            byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
          }
          const entries = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
          return {
            labels: entries.map(([c]) => c),
            values: entries.map(([, v]) => v),
            total: entries.reduce((sum, [, v]) => sum + v, 0),
          };
        })();

  const revenueTotal =
    serverSummary?.totalIncome ??
    items.filter((i) => i.flow === "income" && !i.isTransfer).reduce((s, i) => s + i.amount, 0);

  return {
    expenseBreakdown,
    revenueTotal,
    delta: revenueTotal - expenseBreakdown.total,
    transferCount: serverSummary?.transferCount ?? items.filter((i) => i.isTransfer).length,
    expenseTransactionCount: pagedTotal ?? items.filter((i) => i.flow === "expense").length,
  };
}

export function toDisplayTransaction(tx: BankTransaction): DisplayTransaction {
  const cat = categorizeBankTransaction(tx);
  return {
    id: tx.transactionId,
    dateValue: tx.date,
    dateLabel: formatDateLabel(tx.date),
    name: tx.name,
    merchant: tx.merchantName ?? "-",
    category: cat.resolvedCategory,
    amount: Math.abs(tx.amount),
    isoCurrencyCode: tx.isoCurrencyCode,
    flow: cat.flow,
    source: "bank" as const,
    isTransfer: cat.isTransfer,
  };
}
