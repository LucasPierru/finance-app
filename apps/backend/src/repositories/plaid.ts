import { randomUUID } from "node:crypto";
import { pool } from "@db/pool";
import { serverEnv } from "@config/env";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "@lib/plaid-token-crypto";
import type { BankAccount, BankConnectionState, BankTransaction, PlaidConnection, StoredBankState } from "@lib/types";
import type { TransactionFilters, PagedTransactionsResult, CreateManualTransactionBody } from "@finance-app/shared-types";
import { AppError } from "@lib/errors";

export type { TransactionFilters, PagedTransactionsResult, CreateManualTransactionBody };

function mapAccountRow(row: Record<string, unknown>): BankAccount {
  return {
    accountId: row.account_id != null ? String(row.account_id) : "",
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
    accountId: row.account_id != null ? String(row.account_id) : "",
    date: new Date(String(row.date)).toISOString().slice(0, 10),
    name: String(row.name),
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    amount: Number(row.amount),
    isoCurrencyCode: row.iso_currency_code ? String(row.iso_currency_code) : null,
    category: Array.isArray(row.plaid_category) ? (row.plaid_category as string[]) : [],
    pending: Boolean(row.pending),
    flow: row.flow as 'income' | 'expense',
    personalFinanceCategory: row.personal_finance_category ? String(row.personal_finance_category) : null,
    personalFinanceCategoryDetailed: row.personal_finance_category_detailed ? String(row.personal_finance_category_detailed) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
    subCategoryId: row.sub_category_id ? String(row.sub_category_id) : null,
    subCategoryName: row.sub_category_name ? String(row.sub_category_name) : null,
    isInternal: Boolean(row.is_internal),
  };
}

/** Returns all stored Plaid items for a user (one per connected bank). */
export async function getStoredBankStates(userId: string): Promise<StoredBankState[]> {
  const itemsResult = await pool.query(
    `SELECT access_token, item_id, institution_name, cursor, last_sync_at
     FROM plaid_items
     WHERE user_id = $1`,
    [userId],
  );

  if (itemsResult.rowCount === 0) return [];

  const itemIds = itemsResult.rows.map((r) => String(r.item_id));

  const [accountsResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT account_id, item_id, name, official_name, mask, type, subtype, current_balance, available_balance, iso_currency_code
       FROM plaid_accounts
       WHERE item_id = ANY($1::text[])
       ORDER BY name ASC`,
      [itemIds],
    ),
    pool.query(
      `SELECT id, account_id, date, name, merchant_name, amount, iso_currency_code, plaid_category, pending,
              personal_finance_category, personal_finance_category_detailed,
              category_id, flow, is_internal, sub_category_id,
              (SELECT name FROM categories WHERE id = t.category_id) AS category_name,
              (SELECT name FROM subcategories WHERE id = t.sub_category_id) AS sub_category_name
       FROM transactions t
       WHERE user_id = $1 AND source = 'plaid'
       ORDER BY date DESC, id DESC`,
      [userId],
    ),
  ]);

  // Group accounts by item_id
  const accountsByItemId = new Map<string, BankAccount[]>();
  const accountIdToItemId = new Map<string, string>();
  for (const row of accountsResult.rows) {
    const itemId = String(row.item_id);
    const account = mapAccountRow(row);
    const list = accountsByItemId.get(itemId) ?? [];
    list.push(account);
    accountsByItemId.set(itemId, list);
    accountIdToItemId.set(account.accountId, itemId);
  }

  // Group transactions by item_id (via account_id)
  const transactionsByItemId = new Map<string, BankTransaction[]>();
  for (const row of transactionsResult.rows) {
    const tx = mapTransactionRow(row);
    const itemId = accountIdToItemId.get(tx.accountId);
    if (!itemId) continue;
    const list = transactionsByItemId.get(itemId) ?? [];
    list.push(tx);
    transactionsByItemId.set(itemId, list);
  }

  return itemsResult.rows.map((item) => {
    const itemId = String(item.item_id);
    return {
      accessToken: decryptPlaidAccessToken(String(item.access_token), serverEnv.plaidTokenEncryptionSecret),
      itemId,
      institutionName: item.institution_name ? String(item.institution_name) : null,
      cursor: item.cursor ? String(item.cursor) : null,
      lastSyncAt: item.last_sync_at ? new Date(String(item.last_sync_at)).toISOString() : null,
      accounts: accountsByItemId.get(itemId) ?? [],
      transactions: transactionsByItemId.get(itemId) ?? [],
    };
  });
}

export async function getBankConnectionState(userId: string): Promise<BankConnectionState> {
  const itemsResult = await pool.query(
    `SELECT item_id, institution_name, last_sync_at
     FROM plaid_items
     WHERE user_id = $1
     ORDER BY last_sync_at DESC NULLS LAST`,
    [userId],
  );

  if (itemsResult.rowCount === 0) {
    return {
      connected: false,
      connections: [],
      institutionName: null,
      lastSyncAt: null,
      accounts: [],
      recentTransactions: [],
    };
  }

  const itemIds = itemsResult.rows.map((r) => String(r.item_id));

  const [accountsResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT account_id, item_id, name, official_name, mask, type, subtype, current_balance, available_balance, iso_currency_code
       FROM plaid_accounts
       WHERE item_id = ANY($1::text[])
       ORDER BY name ASC`,
      [itemIds],
    ),
    pool.query(
      `SELECT id, account_id, date, name, merchant_name, amount, iso_currency_code, plaid_category, pending,
              personal_finance_category, personal_finance_category_detailed,
              category_id, flow, is_internal, sub_category_id,
              (SELECT name FROM categories WHERE id = t.category_id) AS category_name,
              (SELECT name FROM subcategories WHERE id = t.sub_category_id) AS sub_category_name
       FROM transactions t
       WHERE user_id = $1 AND (source = 'plaid' OR (source = 'manual' AND t.frequency IS NULL))
       ORDER BY date DESC, id DESC
       LIMIT 200`,
      [userId],
    ),
  ]);

  // Group accounts by item_id
  const accountsByItemId = new Map<string, BankAccount[]>();
  const allAccounts: BankAccount[] = [];
  for (const row of accountsResult.rows) {
    const itemId = String(row.item_id);
    const account = mapAccountRow(row);
    const list = accountsByItemId.get(itemId) ?? [];
    list.push(account);
    accountsByItemId.set(itemId, list);
    allAccounts.push(account);
  }

  const connections: PlaidConnection[] = itemsResult.rows.map((item) => ({
    itemId: String(item.item_id),
    institutionName: item.institution_name ? String(item.institution_name) : null,
    lastSyncAt: item.last_sync_at ? new Date(String(item.last_sync_at)).toISOString() : null,
    accounts: accountsByItemId.get(String(item.item_id)) ?? [],
  }));

  const latestSyncAt =
    connections
      .map((c) => c.lastSyncAt)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1) ?? null;

  return {
    connected: true,
    connections,
    institutionName: connections[0]?.institutionName ?? null,
    lastSyncAt: latestSyncAt,
    accounts: allAccounts,
    recentTransactions: transactionsResult.rows.map(mapTransactionRow),
  };
}

export async function createManualTransaction(
  userId: string,
  data: Required<Pick<CreateManualTransactionBody, "name" | "date" | "amount" | "flow">> & Pick<CreateManualTransactionBody, "categoryId" | "subCategoryId">,
): Promise<BankTransaction> {
  const id = randomUUID();
  const result = await pool.query(
    `INSERT INTO transactions (id, user_id, source, flow, name, amount, date, category_id, sub_category_id)
     VALUES ($1, $2, 'manual', $3, $4, $5, $6::date, $7, $8)
     RETURNING id, account_id, date, name, merchant_name, amount,
               iso_currency_code, plaid_category, pending,
               personal_finance_category, personal_finance_category_detailed,
               category_id, flow, is_internal, sub_category_id`,
    [id, userId, data.flow, data.name, data.amount, data.date, data.categoryId ?? null, data.subCategoryId ?? null],
  );
  const row = result.rows[0];
  const [catResult, subCatResult] = await Promise.all([
    row.category_id ? pool.query(`SELECT name FROM categories WHERE id = $1`, [row.category_id]) : Promise.resolve(null),
    row.sub_category_id ? pool.query(`SELECT name FROM subcategories WHERE id = $1`, [row.sub_category_id]) : Promise.resolve(null),
  ]);
  return mapTransactionRow({ ...row, category_name: catResult?.rows[0]?.name ?? null, sub_category_name: subCatResult?.rows[0]?.name ?? null });
}

export async function getTransactionSummary(
  userId: string,
  filters: TransactionFilters,
): Promise<import('@finance-app/shared-types').TransactionSummary> {
  const conditions: string[] = [
    "t.user_id = $1",
    "(t.source = 'plaid' OR (t.source = 'manual' AND t.frequency IS NULL))",
    "NOT t.is_internal",
  ];
  const params: unknown[] = [userId];

  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    params.push(filters.month);
    conditions.push(`TO_CHAR(t.date, 'YYYY-MM') = $${params.length}`);
  }
  if (filters.flow === 'income') {
    conditions.push("t.flow = 'income'");
  } else if (filters.flow === 'expense') {
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
  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(`t.category_id = $${params.length}`);
  }
  if (filters.subCategoryId) {
    params.push(filters.subCategoryId);
    conditions.push(`t.sub_category_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  // Only exclude credit-card payments and internal account moves that cause double-counting.
  // Do NOT exclude TRANSFER_OUT broadly — ACH rent/mortgage payments come through as TRANSFER_OUT
  // but are genuine expenses and should appear in totals.
  const isTransfer = `COALESCE(
    t.personal_finance_category_detailed = 'TRANSFER_OUT_CREDIT_CARD_PAYMENT'
    OR (t.personal_finance_category = 'TRANSFER_IN'
        AND t.personal_finance_category_detailed IN ('TRANSFER_IN_ACCOUNT_TRANSFER', 'TRANSFER_IN_SAVINGS'))
    OR (LOWER(t.plaid_category->>0) = 'transfer' AND LOWER(t.plaid_category->>1) = 'credit card')
    OR LOWER(t.name) LIKE '%credit card payment%'
    OR LOWER(t.name) LIKE '%autopay%',
    FALSE
  )`;

  const [summaryResult, breakdownResult, dailyResult] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN t.flow = 'income'  AND NOT ${isTransfer} THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN t.flow = 'expense' AND NOT ${isTransfer} THEN t.amount ELSE 0 END), 0) AS total_expenses,
         COUNT(CASE WHEN ${isTransfer} THEN 1 END) AS transfer_count,
         COUNT(CASE WHEN t.flow = 'expense' AND NOT ${isTransfer} THEN 1 END) AS expense_count
       FROM transactions t WHERE ${where}`,
      params,
    ),
    pool.query(
      `SELECT
         COALESCE(c.name, t.plaid_category->>0, 'Other') AS category,
         SUM(t.amount) AS total_amount
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${where}
         AND t.flow = 'expense'
         AND NOT ${isTransfer}
       GROUP BY COALESCE(c.name, t.plaid_category->>0, 'Other')
       ORDER BY total_amount DESC`,
      params,
    ),
    pool.query(
      `SELECT
         TO_CHAR(t.date, 'YYYY-MM-DD') AS day,
         SUM(t.amount) AS total_amount
       FROM transactions t
       WHERE ${where}
         AND t.flow = 'expense'
         AND NOT ${isTransfer}
       GROUP BY day
       ORDER BY day ASC`,
      params,
    ),
  ]);

  const summaryRow = summaryResult.rows[0];
  return {
    totalIncome: Number(summaryRow.total_income),
    totalExpenses: Number(summaryRow.total_expenses),
    transferCount: Number(summaryRow.transfer_count),
    expenseTransactionCount: Number(summaryRow.expense_count),
    categoryBreakdown: breakdownResult.rows.map((r) => ({
      category: String(r.category),
      totalAmount: Number(r.total_amount),
    })),
    dailyExpenseBreakdown: dailyResult.rows.map((r) => ({
      date: String(r.day),
      totalAmount: Number(r.total_amount),
    })),
  };
}

export async function getPagedTransactions(
  userId: string,
  filters: TransactionFilters,
  page: number,
  pageSize: number,
): Promise<PagedTransactionsResult> {
  const conditions: string[] = [
    "t.user_id = $1",
    "(t.source = 'plaid' OR (t.source = 'manual' AND t.frequency IS NULL))",
  ];
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

  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(`t.category_id = $${params.length}`);
  }

  if (filters.subCategoryId) {
    params.push(filters.subCategoryId);
    conditions.push(`t.sub_category_id = $${params.length}`);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  const SORT_COL_MAP: Record<string, string> = { date: "t.date", name: "t.name", amount: "t.amount" };
  const sortCol = (filters.sortBy && SORT_COL_MAP[filters.sortBy]) || "t.date";
  const sortDirStr = filters.sortDir === "asc" ? "ASC" : "DESC";

  params.push(pageSize);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM transactions t WHERE ${where}`, params.slice(0, -2)),
    pool.query(
      `SELECT t.id, t.account_id, t.date, t.name, t.merchant_name, t.amount,
              t.iso_currency_code, t.plaid_category, t.pending,
              t.personal_finance_category, t.personal_finance_category_detailed,
              t.category_id, t.flow, t.is_internal, t.sub_category_id,
              c.name AS category_name,
              (SELECT name FROM subcategories WHERE id = t.sub_category_id) AS sub_category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${where}
       ORDER BY ${sortCol} ${sortDirStr}, t.id ${sortDirStr}
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    ),
  ]);

  const total = parseInt(countResult.rows[0].count as string, 10);
  return {
    transactions: dataResult.rows.map(mapTransactionRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
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
      `INSERT INTO plaid_items (item_id, user_id, access_token, institution_name, cursor, last_sync_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (item_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         institution_name = EXCLUDED.institution_name,
         cursor = EXCLUDED.cursor,
         last_sync_at = EXCLUDED.last_sync_at`,
      [state.itemId, userId, encryptedAccessToken, state.institutionName, state.cursor, state.lastSyncAt],
    );

    for (const account of state.accounts) {
      await client.query(
        `INSERT INTO plaid_accounts (
          account_id,
          user_id,
          item_id,
          name,
          official_name,
          mask,
          type,
          subtype,
          current_balance,
          available_balance,
          iso_currency_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (account_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          item_id = EXCLUDED.item_id,
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
          state.itemId,
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
        await client.query(`DELETE FROM plaid_accounts WHERE item_id = $1`, [state.itemId]);
      } else {
        await client.query(
          `DELETE FROM plaid_accounts
           WHERE item_id = $1
             AND NOT (account_id = ANY($2::text[]))`,
          [state.itemId, accountIds],
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
          pending,
          personal_finance_category,
          personal_finance_category_detailed
        ) VALUES ($1, $2, 'plaid', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
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
          personal_finance_category = EXCLUDED.personal_finance_category,
          personal_finance_category_detailed = EXCLUDED.personal_finance_category_detailed,
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
          transaction.personalFinanceCategory ?? null,
          transaction.personalFinanceCategoryDetailed ?? null,
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
      // Only prune transactions that belong to accounts of this specific item,
      // so we don't touch transactions from other connected banks.
      if (accountIds.length === 0) {
        await client.query(
          `DELETE FROM transactions WHERE user_id = $1 AND source = 'plaid'
             AND account_id IN (SELECT account_id FROM plaid_accounts WHERE item_id = $2)`,
          [userId, state.itemId],
        );
      } else {
        await client.query(
          `DELETE FROM transactions
           WHERE user_id = $1 AND source = 'plaid'
             AND account_id = ANY($2::text[])
             AND NOT (id = ANY($3::text[]))`,
          [userId, accountIds, transactionIds],
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

  // Auto-categorize newly uncategorized transactions outside the main transaction
  // so a failure here doesn't roll back the sync itself.
  await autoCategorizeMissingTransactions(userId);
}

/**
 * Assigns category_id to Plaid transactions that have none, using two passes:
 * 1. Plaid personal_finance_category → internal category name mapping
 * 2. Keyword matching on transaction name / merchant name (fallback)
 * Never overwrites user overrides (only touches rows where category_id IS NULL).
 */
async function autoCategorizeMissingTransactions(userId: string): Promise<void> {
  // Pass 1: assign via Plaid primary category mapping
  await pool.query(
    `UPDATE transactions t
     SET category_id = c.id
     FROM categories c
     WHERE t.user_id = $1
       AND t.source = 'plaid'
       AND t.category_id IS NULL
       AND t.personal_finance_category IS NOT NULL
       AND COALESCE(t.personal_finance_category_detailed, '') != 'TRANSFER_OUT_CREDIT_CARD_PAYMENT'
       AND NOT (t.personal_finance_category = 'TRANSFER_IN'
                AND COALESCE(t.personal_finance_category_detailed, '') IN ('TRANSFER_IN_ACCOUNT_TRANSFER', 'TRANSFER_IN_SAVINGS'))
       AND c.type = t.flow
       AND c.name = CASE t.personal_finance_category
         WHEN 'FOOD_AND_DRINK'       THEN 'Food'
         WHEN 'ENTERTAINMENT'        THEN 'Entertainment'
         WHEN 'GENERAL_MERCHANDISE'  THEN 'Shopping'
         WHEN 'HOME_IMPROVEMENT'     THEN 'Housing'
         WHEN 'MEDICAL'              THEN 'Healthcare'
         WHEN 'PERSONAL_CARE'        THEN 'Shopping'
         WHEN 'TRANSPORTATION'       THEN 'Transport'
         WHEN 'TRAVEL'               THEN 'Transport'
         WHEN 'LOAN_PAYMENTS'        THEN 'Debt Payments'
         WHEN 'RENT_AND_UTILITIES'   THEN
           CASE
             WHEN t.personal_finance_category_detailed ILIKE '%RENT%'
               OR t.personal_finance_category_detailed ILIKE '%MORTGAGE%'
               OR t.personal_finance_category_detailed ILIKE '%HOA%'
               OR t.personal_finance_category_detailed ILIKE '%HOMEOWNERS%'
             THEN 'Housing'
             ELSE 'Utilities'
           END
         ELSE NULL
       END`,
    [userId],
  );

  // Pass 2: keyword matching fallback for anything still uncategorized
  await pool.query(
    `UPDATE transactions t
     SET category_id = (
       SELECT c.id
       FROM categories c
       WHERE c.type = t.flow
         AND EXISTS (
           SELECT 1 FROM unnest(c.keywords) AS kw
           WHERE LOWER(t.name) LIKE '%' || LOWER(kw) || '%'
              OR LOWER(COALESCE(t.merchant_name, '')) LIKE '%' || LOWER(kw) || '%'
         )
       ORDER BY c.name
       LIMIT 1
     )
     WHERE t.user_id = $1
       AND t.source = 'plaid'
       AND t.category_id IS NULL
       AND COALESCE(t.personal_finance_category_detailed, '') != 'TRANSFER_OUT_CREDIT_CARD_PAYMENT'
       AND NOT (t.personal_finance_category = 'TRANSFER_IN'
                AND COALESCE(t.personal_finance_category_detailed, '') IN ('TRANSFER_IN_ACCOUNT_TRANSFER', 'TRANSFER_IN_SAVINGS'))`,
    [userId],
  );
}

export async function updateTransactionOverride(
  userId: string,
  transactionId: string,
  categoryId: string | null | undefined,
  flow: string | null | undefined,
  isInternal: boolean | null | undefined,
  subCategoryId: string | null | undefined,
): Promise<BankTransaction> {
  const result = await pool.query(
    `UPDATE transactions
     SET category_id = $3,
         flow = COALESCE($4::text, flow),
         is_internal = COALESCE($5::boolean, is_internal),
         sub_category_id = $6,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND (source = 'plaid' OR (source = 'manual' AND frequency IS NULL))
     RETURNING id, account_id, date, name, merchant_name, amount,
               iso_currency_code, plaid_category, pending,
               personal_finance_category, personal_finance_category_detailed,
               category_id, flow, is_internal, sub_category_id`,
    [transactionId, userId, categoryId ?? null, flow ?? null, isInternal ?? null, subCategoryId ?? null],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(404, "Transaction not found");
  }
  const row = result.rows[0];
  const [catResult, subCatResult] = await Promise.all([
    row.category_id ? pool.query(`SELECT name FROM categories WHERE id = $1`, [row.category_id]) : Promise.resolve(null),
    row.sub_category_id ? pool.query(`SELECT name FROM subcategories WHERE id = $1`, [row.sub_category_id]) : Promise.resolve(null),
  ]);
  return mapTransactionRow({
    ...row,
    category_name: catResult?.rows[0]?.name ?? null,
    sub_category_name: subCatResult?.rows[0]?.name ?? null,
  });
}

/**
 * Updates the category/flow for all transactions matching the same merchant name
 * (or transaction name when no merchant) as the given transaction ID.
 * Returns the number of affected rows.
 */
const FUZZY_SIMILARITY_THRESHOLD = 0.45;

export async function bulkUpdateTransactionsByMerchant(
  userId: string,
  transactionId: string,
  categoryId: string | null | undefined,
  flow: string | null | undefined,
  isInternal: boolean | null | undefined,
  subCategoryId: string | null | undefined,
): Promise<number> {
  const txResult = await pool.query(
    `SELECT merchant_name, name FROM transactions WHERE id = $1 AND user_id = $2 AND (source = 'plaid' OR (source = 'manual' AND frequency IS NULL))`,
    [transactionId, userId],
  );
  if ((txResult.rowCount ?? 0) === 0) {
    throw new AppError(404, "Transaction not found");
  }

  const row = txResult.rows[0];
  const merchantName = row.merchant_name ? String(row.merchant_name) : null;
  const txName = String(row.name);
  // Use merchant_name for fuzzy matching when available, fall back to transaction name
  const matchTarget = merchantName ?? txName;

  const result = await pool.query(
    `UPDATE transactions
     SET category_id = $1,
         flow = COALESCE($2::text, flow),
         is_internal = COALESCE($3::boolean, is_internal),
         sub_category_id = $4,
         updated_at = NOW()
     WHERE user_id = $5
       AND (source = 'plaid' OR (source = 'manual' AND frequency IS NULL))
       AND similarity(LOWER(COALESCE(merchant_name, name)), LOWER($6)) >= $7`,
    [categoryId ?? null, flow ?? null, isInternal ?? null, subCategoryId ?? null, userId, matchTarget, FUZZY_SIMILARITY_THRESHOLD],
  );

  return result.rowCount ?? 0;
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM transactions WHERE id = $1 AND user_id = $2 AND (source = 'plaid' OR (source = 'manual' AND frequency IS NULL))`,
    [transactionId, userId],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(404, "Transaction not found");
  }
}

/**
 * Disconnect a specific bank item (itemId provided) or all items for the user.
 * Transactions for the removed item's accounts are also deleted.
 */
export async function clearStoredBankState(userId: string, itemId?: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (itemId) {
      // Collect account IDs so we can delete the matching transactions.
      const accountsResult = await client.query(
        `SELECT account_id FROM plaid_accounts WHERE item_id = $1`,
        [itemId],
      );
      const accountIds = accountsResult.rows.map((r: Record<string, unknown>) => String(r.account_id));

      if (accountIds.length > 0) {
        await client.query(
          `DELETE FROM transactions WHERE user_id = $1 AND source = 'plaid' AND account_id = ANY($2::text[])`,
          [userId, accountIds],
        );
      }
      // plaid_accounts rows cascade from plaid_items via FK.
      await client.query(`DELETE FROM plaid_items WHERE item_id = $1 AND user_id = $2`, [itemId, userId]);
    } else {
      // Remove everything for this user.
      await client.query(`DELETE FROM transactions WHERE user_id = $1 AND source = 'plaid'`, [userId]);
      await client.query(`DELETE FROM plaid_items WHERE user_id = $1`, [userId]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const replaceStoredBankState = upsertStoredBankState;