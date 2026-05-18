import { randomUUID } from "node:crypto";
import { pool } from "@db/pool";
import { AppError } from "@lib/errors";
import type { Budget } from "@lib/types";

function mapBudget(row: Record<string, unknown>): Budget {
  return {
    id: String(row.id),
    name: String(row.name),
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName: row.category_name != null ? String(row.category_name) : null,
    amount: Number(row.amount),
    period: row.period as Budget["period"],
  };
}

export async function getBudgets(userId: string): Promise<Budget[]> {
  const result = await pool.query(
    `SELECT b.id, b.name, b.category_id, c.name AS category_name, b.amount, b.period
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = $1
     ORDER BY b.name ASC`,
    [userId],
  );

  return result.rows.map(mapBudget);
}

export async function createBudget(
  userId: string,
  name: string,
  amount: number,
  period: Budget["period"],
  categoryId: string | null,
): Promise<Budget> {
  if (categoryId) {
    const catResult = await pool.query(
      `SELECT id, name FROM categories WHERE id = $1 AND type = 'expense'`,
      [categoryId],
    );

    if ((catResult.rowCount ?? 0) === 0) {
      throw new AppError(400, "Category not found or not an expense category");
    }
  }

  const id = randomUUID();

  const result = await pool.query(
    `INSERT INTO budgets (id, user_id, name, category_id, amount, period)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, category_id, amount, period`,
    [id, userId, name, categoryId ?? null, amount, period],
  );

  const row = result.rows[0];

  let categoryName: string | null = null;
  if (categoryId) {
    const catResult = await pool.query(`SELECT name FROM categories WHERE id = $1`, [categoryId]);
    categoryName = catResult.rows[0]?.name ?? null;
  }

  return {
    id: String(row.id),
    name: String(row.name),
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName,
    amount: Number(row.amount),
    period: row.period as Budget["period"],
  };
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  fields: { name?: string; amount?: number; period?: Budget["period"]; categoryId?: string | null },
): Promise<Budget> {
  const existing = await pool.query(
    `SELECT b.id, b.name, b.category_id, c.name AS category_name, b.amount, b.period
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [budgetId, userId],
  );

  if ((existing.rowCount ?? 0) === 0) {
    throw new AppError(404, "Budget not found");
  }

  const current = mapBudget(existing.rows[0]);

  const newCategoryId = Object.prototype.hasOwnProperty.call(fields, "categoryId") ? fields.categoryId : current.categoryId;

  if (newCategoryId) {
    const catResult = await pool.query(
      `SELECT id FROM categories WHERE id = $1 AND type = 'expense'`,
      [newCategoryId],
    );

    if ((catResult.rowCount ?? 0) === 0) {
      throw new AppError(400, "Category not found or not an expense category");
    }
  }

  const result = await pool.query(
    `UPDATE budgets
     SET name = $1, amount = $2, period = $3, category_id = $4, updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING id, name, category_id, amount, period`,
    [
      fields.name ?? current.name,
      fields.amount ?? current.amount,
      fields.period ?? current.period,
      newCategoryId ?? null,
      budgetId,
      userId,
    ],
  );

  const row = result.rows[0];

  let categoryName: string | null = null;
  if (row.category_id) {
    const catResult = await pool.query(`SELECT name FROM categories WHERE id = $1`, [row.category_id]);
    categoryName = catResult.rows[0]?.name ?? null;
  }

  return {
    id: String(row.id),
    name: String(row.name),
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName,
    amount: Number(row.amount),
    period: row.period as Budget["period"],
  };
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const result = await pool.query(`DELETE FROM budgets WHERE id = $1 AND user_id = $2`, [budgetId, userId]);

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(404, "Budget not found");
  }
}
