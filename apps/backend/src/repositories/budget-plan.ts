import { randomUUID } from "node:crypto";
import { pool } from "@db/pool";
import { AppError } from "@lib/errors";
import type { BudgetPlan, BudgetPlanItem } from "@lib/types";

function mapItem(row: Record<string, unknown>): BudgetPlanItem {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName: row.category_name != null ? String(row.category_name) : null,
    amount: Number(row.amount),
    period: row.period as BudgetPlanItem["period"],
  };
}

export async function getBudgetPlans(userId: string): Promise<BudgetPlan[]> {
  const plansResult = await pool.query(
    `SELECT id, name FROM budget_plans WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );

  if (plansResult.rows.length === 0) return [];

  const planIds = plansResult.rows.map((r) => String(r.id));

  const itemsResult = await pool.query(
    `SELECT id, plan_id, category_id, category_name, amount, period
     FROM budget_plan_items
     WHERE plan_id = ANY($1)
     ORDER BY created_at ASC`,
    [planIds],
  );

  const itemsByPlan = new Map<string, BudgetPlanItem[]>();
  for (const row of itemsResult.rows) {
    const planId = String(row.plan_id);
    const list = itemsByPlan.get(planId) ?? [];
    list.push(mapItem(row));
    itemsByPlan.set(planId, list);
  }

  return plansResult.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    items: itemsByPlan.get(String(row.id)) ?? [],
  }));
}

export async function createBudgetPlan(
  userId: string,
  name: string,
  items: Array<{ categoryId: string | null; amount: number; period: BudgetPlanItem["period"] }>,
): Promise<BudgetPlan> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const planId = randomUUID();
    await client.query(
      `INSERT INTO budget_plans (id, user_id, name) VALUES ($1, $2, $3)`,
      [planId, userId, name],
    );

    const createdItems: BudgetPlanItem[] = [];

    for (const item of items) {
      const itemId = randomUUID();

      let categoryName: string | null = null;
      if (item.categoryId) {
        const catResult = await client.query(
          `SELECT name FROM categories WHERE id = $1 AND type = 'expense'`,
          [item.categoryId],
        );
        if ((catResult.rowCount ?? 0) === 0) {
          throw new AppError(400, "Category not found or not an expense category");
        }
        categoryName = String(catResult.rows[0].name);
      }

      await client.query(
        `INSERT INTO budget_plan_items (id, plan_id, category_id, category_name, amount, period)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [itemId, planId, item.categoryId ?? null, categoryName, item.amount, item.period],
      );

      createdItems.push({
        id: itemId,
        planId,
        categoryId: item.categoryId,
        categoryName,
        amount: item.amount,
        period: item.period,
      });
    }

    await client.query("COMMIT");

    return { id: planId, name, items: createdItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteBudgetPlan(userId: string, planId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM budget_plans WHERE id = $1 AND user_id = $2`,
    [planId, userId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(404, "Budget plan not found");
  }
}
