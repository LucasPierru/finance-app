-- Migration 005: add flow, sub_category_id, sub_category_name to budget_plan_items

ALTER TABLE budget_plan_items
  ADD COLUMN IF NOT EXISTS sub_category_id TEXT REFERENCES subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_category_name TEXT,
  ADD COLUMN IF NOT EXISTS flow TEXT NOT NULL DEFAULT 'expense' CHECK (flow IN ('income', 'expense'));
