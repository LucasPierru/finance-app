-- Migration 001: Unify plaid_transactions and transactions into a single table
-- Run this once against any existing database.
-- A fresh database using schema.sql does not need this migration.

BEGIN;

-- Step 1: rename old manual table so we can recreate transactions
ALTER TABLE transactions RENAME TO manual_transactions_backup;

-- Step 2: create the new unified transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual', 'plaid')),
  flow TEXT NOT NULL CHECK (flow IN ('income', 'expense')),
  name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  -- manual-specific (null for plaid)
  raw_amount TEXT,
  frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  -- plaid-specific (null for manual)
  account_id TEXT,
  merchant_name TEXT,
  iso_currency_code TEXT,
  plaid_category JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: migrate manual entries
INSERT INTO transactions (
  id, user_id, source, flow, name, amount, date,
  category_id, raw_amount, frequency, created_at, updated_at
)
SELECT
  id, user_id, 'manual', type, name, amount, created_at::date,
  category_id, raw_amount, frequency, created_at, updated_at
FROM manual_transactions_backup;

-- Step 4: migrate plaid entries (normalize signed amounts → positive + flow)
INSERT INTO transactions (
  id, user_id, source, flow, name, amount, date,
  category_id, account_id, merchant_name, iso_currency_code,
  plaid_category, pending, created_at, updated_at
)
SELECT
  transaction_id,
  user_id,
  'plaid',
  CASE WHEN amount < 0 THEN 'income' ELSE 'expense' END,
  name,
  ABS(amount),
  date,
  user_category_id,
  account_id,
  merchant_name,
  iso_currency_code,
  category,
  pending,
  NOW(),
  NOW()
FROM plaid_transactions;

-- Step 5: create indexes
CREATE INDEX transactions_user_source_idx ON transactions(user_id, source);
CREATE INDEX transactions_user_date_idx ON transactions(user_id, date DESC);

-- Step 6: drop old tables
DROP TABLE plaid_transactions;
DROP TABLE manual_transactions_backup;

COMMIT;
