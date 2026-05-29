import type { BudgetPlanItem } from "@finance-app/shared-types";
import type { FinanceItem } from "$lib/stores/finance";

export type Period = "weekly" | "monthly" | "yearly";

export function toMonthly(amount: number, period: Period): number {
  if (period === "weekly") return (amount * 52) / 12;
  if (period === "yearly") return amount / 12;
  return amount;
}

export function periodLabel(period: Period): string {
  return period === "weekly" ? "/ wk" : period === "yearly" ? "/ yr" : "/ mo";
}

export function spentForItem(item: BudgetPlanItem, costs: FinanceItem[]): number {
  if (!item.categoryId) return 0;
  return costs.filter((c) => c.categoryId === item.categoryId).reduce((sum, c) => sum + c.amount, 0);
}

export function itemProgress(
  item: BudgetPlanItem,
  costs: FinanceItem[],
): { spent: number; monthly: number; pct: number; over: boolean } {
  const monthly = toMonthly(item.amount, item.period as Period);
  const spent = spentForItem(item, costs);
  const raw = monthly > 0 ? (spent / monthly) * 100 : 0;
  const pct = Math.min(raw, 100);
  return { spent, monthly, pct, over: spent > monthly };
}

const SPENT_OK = "hsl(142 71% 45% / 0.85)";
const SPENT_OVER = "hsl(0 72% 51% / 0.85)";
const SPENT_WARN = "hsl(43 96% 56% / 0.85)";

export function spentColor(spent: number, budget: number): string {
  if (budget <= 0) return SPENT_OK;
  const pct = spent / budget;
  if (pct > 1) return SPENT_OVER;
  if (pct >= 0.85) return SPENT_WARN;
  return SPENT_OK;
}
