import { pool } from "@db/pool";
import { serverEnv } from "@config/env";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "@lib/plaid-token-crypto";
import type { BankAccount, BankConnectionState, BankTransaction, StoredBankState } from "@lib/types";
import type { TransactionFilters, PagedTransactionsResult } from "@finance-app/shared-types";
import { AppError } from "@lib/errors";

export type { TransactionFilters, PagedTransactionsResult };

function mapAccountRow(row: Record<string, unknown>): BankAccount {
  return {
    accountId: String(row.account_id),
    name: String(row.name),
    officialName: row.official_name ? String(row.official_name) : null,
    mask: row.mask ? String(row.mask) : null,
    type: String(row.type),
    subtype: row.subtype ? String(row.subtype) : null,
    currentBalance: row.current_balance === null ? null : Number(row.current_balance),
    availableBalance: row.available_balance === null ? null : Number(row.available_balance),
    isoCurrencyCode: row.iso_currency_code ? String(row.iso_currency_code) : null,
  };
}

function mapTransactionRow(row: Record<string, unknown>): BankTransaction {
  return {
    transactionId: String(row.id),
    accountId: String(row.account_id),
    date: new Date(String(row.date)).toISOString().slice(0, 10),
    name: String(row.name),
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    amount: Number(row.amount),
    isoCurrencyCode: row.iso_currency_code ? String(row.iso_currency_code) : null,
    category: Array.isArray(row.plaid_category) ? (row.plaid_category as string[]) : [],
    pending: Boolean(row.pending),
    flow: row.flow as 'income' | 'expense',
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
  };
}

export async function getStoredBankState(userId: string): Promise<StoredBankState | null> {
  const itemResult = await pool.query(
    `SELECT access_token, item_id, institution_name, cursor, last_sync_at
     FROM plaid_items
     WHERE user_id = $1`,
    [userId],
  );

  if (itemResult.rowCount === 0) {
    return null;
  }

  const [accountsResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT account_id, name, official_name, mask, type, subtype, current_balance, available_balance, iso_currency_code
       FROM plaid_accounts
       WHERE user_id = $1
       ORDER BY name ASC`,
      [userId],
    ),
    pool.query(
      `SELECT id, account_id, date, name, merchant_name, amount, iso_currency_code, plaid_category, pending,
              category_id, flow,
              (SELECT name FROM categories WHERE id = t.category_id) AS category_name
       FROM transactions t
       WHERE user_id = $1 AND source = 'plaid'
       ORDER BY date DESC, id DESC`,
      [userId],
    ),
  ]);

  const item = itemResult.rows[0];
  return {
    accessToken: decryptPlaidAccessToken(String(item.access_token), serverEnv.plaidTokenEncryptionSecret),
    itemId: String(item.item_id),
    institutionName: item.institution_name ? String(item.institution_name) : null,
    cursor: item.cursor ? String(item.cursor) : null,
    lastSyncAt: item.last_sync_at ? new Date(String(item.last_sync_at)).toISOString() : null,
    accounts: accountsResult.rows.map(mapAccountRow),
    transactions: transactionsResult.rows.map(mapTransactionRow),
  };
}

export async function getBankConnectionState(userId: string): Promise<BankConnectionState> {
  const state = await getStoredBankState(userId);

  return {
    connected: Boolean(state),
    institutionName: state?.institutionName ?? null,
    lastSyncAt: state?.lastSyncAt ?? null,
    accounts: state?.accounts ?? [],
    recentTransactions: state?.transactions.slice(0, 200) ?? [],
  };
}

export async function getPagedTransactions(
  userId: string,
  filters: TransactionFilters,
  page: number,
  pageSize: number,
): Promise<PagedTransactionsResult> {
  const conditions: string[] = ["t.user_id = $1", "t.source = 'plaid'"];
  const params: unknown[] = [userId];

  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    params.push(filters.month);
    conditions.push(`TO_CHAR(t.date, 'YYYY-MM') = $${params.length}`);
  }

  if (filters.flow === "income") {
    conditions.push("t.flow = 'income'");
  } else if (filters.flow === "expense") {
    conditions.push("t.flow = 'expense'");
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(t.name ILIKE $${params.length} OR t.merchant_name ILIKE $${params.length})`);
  }

  if (filters.minAmount !== undefined) {
    params.push(filters.minAmount);
    conditions.push(`t.amount >= $${params.length}`);
  }

  if (filters.maxAmount !== undefined) {
    params.push(filters.maxAmount);
    conditions.push(`t.amount <= $${params.length}`);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const [countResult, dataResult, summaryResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM transactions t WHERE ${where}`, params.slice(0, -2)),
    pool.query(
      `SELECT t.id, t.account_id, t.date, t.name, t.merchant_name, t.amount,
              t.iso_currency_code, t.plaid_category, t.pending,
              t.category_id, t.flow,
              c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${where}
       ORDER BY t.date DESC, t.id DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN t.flow = 'income' THEN t.amount ELSE 0 END), 0)  AS total_income,
         COALESCE(SUM(CASE WHEN t.flow = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expenses
       FROM transactions t WHERE ${where}`,
      params.slice(0, -2),
    ),
  ]);

  const total = parseInt(countResult.rows[0].count as string, 10);
  const summaryRow = summaryResult.rows[0];

  return {
    transactions: dataResult.rows.map(mapTransactionRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      totalIncome: Number(summaryRow.total_income),
      totalExpenses: Number(summaryRow.total_expenses),
    },
  };
}

interface UpsertStoredBankStateOptions {
  removedTransactionIds?: string[];
  pruneMissingAccounts?: boolean;
  pruneMissingTransactions?: boolean;
}

export async function upsertStoredBankState(
  userId: string,
  state: StoredBankState,
  options: UpsertStoredBankStateOptions = {},
): Promise<void> {
  const encryptedAccessToken = encryptPlaidAccessToken(state.accessToken, serverEnv.plaidTokenEncryptionSecret);
  const removedTransactionIds = options.removedTransactionIds ?? [];
  const accountIds = state.accounts.map((account) => account.accountId);
  const transactionIds = state.transactions.map((transaction) => transaction.transactionId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO plaid_items (user_id, access_token, item_id, institution_name, cursor, last_sync_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         item_id = EXCLUDED.item_id,
         institution_name = EXCLUDED.institution_name,
         cursor = EXCLUDED.cursor,
         last_sync_at = EXCLUDED.last_sync_at`,
      [userId, encryptedAccessToken, state.itemId, state.institutionName, state.cursor, state.lastSyncAt],
    );

    for (const account of state.accounts) {
      await client.query(
        `INSERT INTO plaid_accounts (
          account_id,
          user_id,
          name,
          official_name,
          mask,
          type,
          subtype,
          current_balance,
          available_balance,
          iso_currency_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (account_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          official_name = EXCLUDED.official_name,
          mask = EXCLUDED.mask,
          type = EXCLUDED.type,
          subtype = EXCLUDED.subtype,
          current_balance = EXCLUDED.current_balance,
          available_balance = EXCLUDED.available_balance,
          iso_currency_code = EXCLUDED.iso_currency_code`,
        [
          account.accountId,
          userId,
          account.name,
          account.officialName,
          account.mask,
          account.type,
          account.subtype,
          account.currentBalance,
          account.availableBalance,
          account.isoCurrencyCode,
        ],
      );
    }

    if (options.pruneMissingAccounts) {
      if (accountIds.length === 0) {
        await client.query(`DELETE FROM plaid_accounts WHERE user_id = $1`, [userId]);
      } else {
        await client.query(
          `DELETE FROM plaid_accounts
           WHERE user_id = $1
             AND NOT (account_id = ANY($2::text[]))`,
          [userId, accountIds],
        );
      }
    }

    for (const transaction of state.transactions) {
      await client.query(
        `INSERT INTO transactions (
          id,
          user_id,
          source,
          flow,
          name,
          amount,
          date,
          account_id,
          merchant_name,
          iso_currency_code,
          plaid_category,
          pending
        ) VALUES ($1, $2, 'plaid', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          account_id = EXCLUDED.account_id,
          merchant_name = EXCLUDED.merchant_name,
          iso_currency_code = EXCLUDED.iso_currency_code,
          plaid_category = EXCLUDED.plaid_category,
          pending = EXCLUDED.pending,
          updated_at = NOW()
          -- flow and category_id intentionally not updated to preserve user overrides`,
        [
          transaction.transactionId,
          userId,
          transaction.flow,
          transaction.name,
          transaction.amount,
          transaction.date,
          transaction.accountId,
          transaction.merchantName,
          transaction.isoCurrencyCode,
          JSON.stringify(transaction.category),
          transaction.pending,
        ],
      );
    }

    if (removedTransactionIds.length > 0) {
      await client.query(
        `DELETE FROM transactions
         WHERE user_id = $1 AND source = 'plaid'
           AND id = ANY($2::text[])`,
        [userId, removedTransactionIds],
      );
    }

    if (options.pruneMissingTransactions) {
      if (transactionIds.length === 0) {
        await client.query(`DELETE FROM transactions WHERE user_id = $1 AND source = 'plaid'`, [userId]);
      } else {
        await client.query(
          `DELETE FROM transactions
           WHERE user_id = $1 AND source = 'plaid'
             AND NOT (id = ANY($2::text[]))`,
          [userId, transactionIds],
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTransactionOverride(
  userId: string,
  transactionId: string,
  categoryId: string | null | undefined,
  flow: string | null | undefined,
): Promise<BankTransaction> {
  const result = await pool.query(
    `UPDATE transactions
     SET category_id = $3,
         flow = COALESCE($4::text, flow),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND source = 'plaid'
     RETURNING id, account_id, date, name, merchant_name, amount,
               iso_currency_code, plaid_category, pending, category_id, flow`,
    [transactionId, userId, categoryId ?? null, flow ?? null],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(404, "Transaction not found");
  }
  const row = result.rows[0];
  let categoryName: string | null = null;
  if (row.category_id) {
    const catResult = await pool.query(`SELECT name FROM categories WHERE id = $1`, [row.category_id]);
    if (catResult.rows.length > 0) categoryName = String(catResult.rows[0].name);
  }
  return mapTransactionRow({ ...row, category_name: categoryName });
}

export async function clearStoredBankState(userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM plaid_accounts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM transactions WHERE user_id = $1 AND source = 'plaid'`, [userId]);
    await client.query(`DELETE FROM plaid_items WHERE user_id = $1`, [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const replaceStoredBankState = upsertStoredBankState;