-- Migration 007: allow biweekly period in budget_plan_items

ALTER TABLE budget_plan_items
  DROP CONSTRAINT IF EXISTS budget_plan_items_period_check,
  ADD CONSTRAINT budget_plan_items_period_check
    CHECK (period IN ('weekly', 'biweekly', 'monthly', 'yearly'));
