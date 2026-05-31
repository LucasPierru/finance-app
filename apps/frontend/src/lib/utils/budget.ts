import type { BudgetPlanItem } from "@finance-app/shared-types";
import type { FinanceItem } from "$lib/stores/finance";

export type Period = "weekly" | "biweekly" | "monthly" | "yearly";

export function toMonthly(amount: number, period: Period): number {
  if (period === "weekly") return (amount * 52) / 12;
  if (period === "biweekly") return (amount * 26) / 12;
  if (period === "yearly") return amount / 12;
  return amount;
}

export function periodLabel(period: Period): string {
  if (period === "weekly") return "/ wk";
  if (period === "biweekly") return "/ 2wk";
  if (period === "yearly") return "/ yr";
  return "/ mo";
}

export type CostItem = FinanceItem & { subCategoryId?: string };

export function spentForItem(item: BudgetPlanItem, costs: CostItem[]): number {
  if (item.subCategoryId) {
    return costs
      .filter((c) => c.subCategoryId === item.subCategoryId)
      .reduce((sum, c) => sum + c.amount, 0);
  }
  if (!item.categoryId) return 0;
  return costs
    .filter((c) => c.categoryId === item.categoryId)
    .reduce((sum, c) => sum + c.amount, 0);
}

export function itemProgress(
  item: BudgetPlanItem,
  costs: CostItem[],
): { spent: number; monthly: number; pct: number; over: boolean; remaining: number } {
  const monthly = toMonthly(item.amount, item.period as Period);
  const spent = spentForItem(item, costs);
  const raw = monthly > 0 ? (spent / monthly) * 100 : 0;
  const pct = Math.min(raw, 100);
  return { spent, monthly, pct, over: spent > monthly, remaining: monthly - spent };
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
