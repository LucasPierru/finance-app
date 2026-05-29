-- Migration 003: Add Plaid personal_finance_category columns for better categorization
-- Run once against any existing database. Fresh databases using schema.sql do not need this.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS personal_finance_category TEXT,
  ADD COLUMN IF NOT EXISTS personal_finance_category_detailed TEXT;

CREATE INDEX IF NOT EXISTS transactions_pfc_idx ON transactions(personal_finance_category)
  WHERE personal_finance_category IS NOT NULL;
