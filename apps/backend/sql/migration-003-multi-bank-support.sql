-- Migration 003: Support multiple bank connections per user
--
-- Changes plaid_items primary key from user_id to item_id so a single user
-- can have more than one Plaid item (i.e. multiple connected banks).
-- Adds item_id to plaid_accounts to preserve the per-item association.

-- Step 1: Drop old user_id PK and the separate UNIQUE on item_id, then
--         promote item_id to primary key.
ALTER TABLE plaid_items DROP CONSTRAINT IF EXISTS plaid_items_pkey;
ALTER TABLE plaid_items DROP CONSTRAINT IF EXISTS plaid_items_item_id_key;
ALTER TABLE plaid_items ADD PRIMARY KEY (item_id);

-- Keep fast lookups by user.
CREATE INDEX IF NOT EXISTS plaid_items_user_idx ON plaid_items(user_id);

-- Step 2: Add item_id column to plaid_accounts.
ALTER TABLE plaid_accounts ADD COLUMN IF NOT EXISTS item_id TEXT;

-- Backfill from the single existing item per user (safe for existing single-bank data).
UPDATE plaid_accounts
SET item_id = pi.item_id
FROM plaid_items pi
WHERE plaid_accounts.user_id = pi.user_id
  AND plaid_accounts.item_id IS NULL;

-- Remove any orphaned account rows that could not be linked (should not exist).
DELETE FROM plaid_accounts WHERE item_id IS NULL;

-- Enforce NOT NULL and add the FK so future rows are always linked.
ALTER TABLE plaid_accounts ALTER COLUMN item_id SET NOT NULL;

ALTER TABLE plaid_accounts DROP CONSTRAINT IF EXISTS plaid_accounts_item_id_fkey;
ALTER TABLE plaid_accounts ADD CONSTRAINT plaid_accounts_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES plaid_items(item_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS plaid_accounts_item_idx ON plaid_accounts(item_id);
