import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@db/pool";
import { AppError } from "@lib/errors";
import type { BudgetPlan, BudgetPlanItem } from "@lib/types";

function mapItem(row: Record<string, unknown>): BudgetPlanItem {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName: row.category_name != null ? String(row.category_name) : null,
    subCategoryId: row.sub_category_id != null ? String(row.sub_category_id) : null,
    subCategoryName: row.sub_category_name != null ? String(row.sub_category_name) : null,
    amount: Number(row.amount),
    period: row.period as BudgetPlanItem["period"],
    flow: (row.flow as BudgetPlanItem["flow"]) ?? "expense",
  };
}

export async function getBudgetPlans(userId: string): Promise<BudgetPlan[]> {
  const plansResult = await pool.query(
    `SELECT id, name, is_favorite FROM budget_plans WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );

  if (plansResult.rows.length === 0) return [];

  const planIds = plansResult.rows.map((r) => String(r.id));

  const itemsResult = await pool.query(
    `SELECT id, plan_id, category_id, category_name, sub_category_id, sub_category_name, amount, period, flow
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
    isFavorite: Boolean(row.is_favorite),
    items: itemsByPlan.get(String(row.id)) ?? [],
  }));
}

type ItemInput = {
  categoryId: string | null;
  subCategoryId?: string | null;
  amount: number;
  period: BudgetPlanItem["period"];
  flow: "income" | "expense";
};

async function resolveItemNames(
  client: PoolClient,
  item: ItemInput,
): Promise<{ categoryName: string | null; subCategoryName: string | null }> {
  if (item.subCategoryId) {
    const subResult = await client.query(
      `SELECT sc.name AS sub_name, c.name AS cat_name, c.type AS cat_type
       FROM subcategories sc
       JOIN categories c ON c.id = sc.category_id
       WHERE sc.id = $1`,
      [item.subCategoryId],
    );
    if ((subResult.rowCount ?? 0) === 0) {
      throw new AppError(400, "Subcategory not found");
    }
    const row = subResult.rows[0];
    if (String(row.cat_type) !== item.flow) {
      throw new AppError(400, `Subcategory does not match item flow (${item.flow})`);
    }
    return { categoryName: String(row.cat_name), subCategoryName: String(row.sub_name) };
  }

  if (item.categoryId) {
    const catResult = await client.query(
      `SELECT name FROM categories WHERE id = $1 AND type = $2`,
      [item.categoryId, item.flow],
    );
    if ((catResult.rowCount ?? 0) === 0) {
      throw new AppError(400, `Category not found or does not match flow (${item.flow})`);
    }
    return { categoryName: String(catResult.rows[0].name), subCategoryName: null };
  }

  return { categoryName: null, subCategoryName: null };
}

export async function createBudgetPlan(
  userId: string,
  name: string,
  items: Array<{ categoryId: string | null; subCategoryId?: string | null; amount: number; period: BudgetPlanItem["period"]; flow?: "income" | "expense" }>,
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
      const flow = item.flow ?? "expense";
      const normalizedItem: ItemInput = {
        categoryId: item.categoryId,
        subCategoryId: item.subCategoryId,
        amount: item.amount,
        period: item.period,
        flow,
      };

      const { categoryName, subCategoryName } = await resolveItemNames(client, normalizedItem);

      await client.query(
        `INSERT INTO budget_plan_items
           (id, plan_id, category_id, category_name, sub_category_id, sub_category_name, amount, period, flow)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [itemId, planId, item.categoryId ?? null, categoryName, item.subCategoryId ?? null, subCategoryName, item.amount, item.period, flow],
      );

      createdItems.push({
        id: itemId,
        planId,
        categoryId: item.categoryId ?? null,
        categoryName,
        subCategoryId: item.subCategoryId ?? null,
        subCategoryName,
        amount: item.amount,
        period: item.period,
        flow,
      });
    }

    await client.query("COMMIT");

    return { id: planId, name, isFavorite: false, items: createdItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBudgetPlan(
  userId: string,
  planId: string,
  name: string,
  items: Array<{ categoryId: string | null; subCategoryId?: string | null; amount: number; period: BudgetPlanItem["period"]; flow?: "income" | "expense" }>,
): Promise<BudgetPlan> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const planResult = await client.query(
      `UPDATE budget_plans SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name`,
      [name, planId, userId],
    );
    if ((planResult.rowCount ?? 0) === 0) {
      throw new AppError(404, "Budget plan not found");
    }

    await client.query(`DELETE FROM budget_plan_items WHERE plan_id = $1`, [planId]);

    const createdItems: BudgetPlanItem[] = [];
    for (const item of items) {
      const itemId = randomUUID();
      const flow = item.flow ?? "expense";
      const normalizedItem: ItemInput = {
        categoryId: item.categoryId,
        subCategoryId: item.subCategoryId,
        amount: item.amount,
        period: item.period,
        flow,
      };

      const { categoryName, subCategoryName } = await resolveItemNames(client, normalizedItem);

      await client.query(
        `INSERT INTO budget_plan_items
           (id, plan_id, category_id, category_name, sub_category_id, sub_category_name, amount, period, flow)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [itemId, planId, item.categoryId ?? null, categoryName, item.subCategoryId ?? null, subCategoryName, item.amount, item.period, flow],
      );

      createdItems.push({
        id: itemId,
        planId,
        categoryId: item.categoryId ?? null,
        categoryName,
        subCategoryId: item.subCategoryId ?? null,
        subCategoryName,
        amount: item.amount,
        period: item.period,
        flow,
      });
    }

    await client.query("COMMIT");
    return { id: planId, name, isFavorite: false, items: createdItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setFavoriteBudgetPlan(userId: string, planId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE budget_plans SET is_favorite = false WHERE user_id = $1`,
      [userId],
    );
    const result = await client.query(
      `UPDATE budget_plans SET is_favorite = true WHERE id = $1 AND user_id = $2`,
      [planId, userId],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(404, "Budget plan not found");
    }
    await client.query("COMMIT");
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
