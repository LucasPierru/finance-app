import type { BudgetPlan, BudgetPlanItem, FinanceCategory } from "@finance-app/shared-types";
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

export function buildCurrentMonthCosts(
  categoryBreakdown: Array<{ category: string; totalAmount: number }>,
  subCategoryBreakdown: Array<{ categoryId: string | null; subCategoryId: string; subCategoryName: string; totalAmount: number }>,
  allCategories: FinanceCategory[],
  fallbackCosts: CostItem[],
): CostItem[] {
  if (categoryBreakdown.length === 0) return fallbackCosts;

  const catItems: CostItem[] = categoryBreakdown.map((b, i) => {
    const cat = allCategories.find((c) => c.type === "expense" && c.name === b.category);
    return {
      id: `month-cat-${i}`,
      name: b.category,
      category: b.category,
      categoryId: cat?.id,
      amount: b.totalAmount,
      rawAmount: b.totalAmount.toFixed(2),
      frequency: "monthly" as const,
    };
  });

  const subItems: CostItem[] = subCategoryBreakdown.map((s, i) => ({
    id: `month-sub-${i}`,
    name: s.subCategoryName,
    category: s.subCategoryName,
    categoryId: s.categoryId ?? undefined,
    subCategoryId: s.subCategoryId,
    amount: s.totalAmount,
    rawAmount: s.totalAmount.toFixed(2),
    frequency: "monthly" as const,
  }));

  return [...catItems, ...subItems];
}

export interface PlanHealth {
  totalBudget: number;
  totalSpent: number;
  overCount: number;
  budgetIncome: number;
}

export function buildPlanHealth(plan: BudgetPlan, costs: CostItem[]): PlanHealth | null {
  const expenseItems = plan.items.filter((i) => (i.flow ?? "expense") === "expense");
  if (expenseItems.length === 0) return null;
  let totalBudget = 0;
  let totalSpent = 0;
  let overCount = 0;
  for (const item of expenseItems) {
    const { spent, monthly, over } = itemProgress(item, costs);
    totalBudget += monthly;
    totalSpent += spent;
    if (over) overCount++;
  }
  const incomeItems = plan.items.filter((i) => i.flow === "income");
  const budgetIncome = incomeItems.reduce((s, i) => s + toMonthly(i.amount, i.period as Period), 0);
  return { totalBudget, totalSpent, overCount, budgetIncome };
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
