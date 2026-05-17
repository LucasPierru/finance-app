import { pool } from "@db/pool";
import { serverEnv } from "@config/env";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "@lib/plaid-token-crypto";
import type { BankAccount, BankConnectionState, BankTransaction, StoredBankState } from "@lib/types";

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
    transactionId: String(row.transaction_id),
    accountId: String(row.account_id),
    date: new Date(String(row.date)).toISOString().slice(0, 10),
    name: String(row.name),
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    amount: Number(row.amount),
    isoCurrencyCode: row.iso_currency_code ? String(row.iso_currency_code) : null,
    category: Array.isArray(row.category) ? (row.category as string[]) : [],
    pending: Boolean(row.pending),
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
      `SELECT transaction_id, account_id, date, name, merchant_name, amount, iso_currency_code, category, pending
       FROM plaid_transactions
       WHERE user_id = $1
       ORDER BY date DESC, transaction_id DESC`,
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
        `INSERT INTO plaid_transactions (
          transaction_id,
          user_id,
          account_id,
          date,
          name,
          merchant_name,
          amount,
          iso_currency_code,
          category,
          pending
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        ON CONFLICT (transaction_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          account_id = EXCLUDED.account_id,
          date = EXCLUDED.date,
          name = EXCLUDED.name,
          merchant_name = EXCLUDED.merchant_name,
          amount = EXCLUDED.amount,
          iso_currency_code = EXCLUDED.iso_currency_code,
          category = EXCLUDED.category,
          pending = EXCLUDED.pending`,
        [
          transaction.transactionId,
          userId,
          transaction.accountId,
          transaction.date,
          transaction.name,
          transaction.merchantName,
          transaction.amount,
          transaction.isoCurrencyCode,
          JSON.stringify(transaction.category),
          transaction.pending,
        ],
      );
    }

    if (removedTransactionIds.length > 0) {
      await client.query(
        `DELETE FROM plaid_transactions
         WHERE user_id = $1
           AND transaction_id = ANY($2::text[])`,
        [userId, removedTransactionIds],
      );
    }

    if (options.pruneMissingTransactions) {
      if (transactionIds.length === 0) {
        await client.query(`DELETE FROM plaid_transactions WHERE user_id = $1`, [userId]);
      } else {
        await client.query(
          `DELETE FROM plaid_transactions
           WHERE user_id = $1
             AND NOT (transaction_id = ANY($2::text[]))`,
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

export async function clearStoredBankState(userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM plaid_accounts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM plaid_transactions WHERE user_id = $1`, [userId]);
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