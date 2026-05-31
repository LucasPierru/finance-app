-- Migration 006: add is_favorite to budget_plans

ALTER TABLE budget_plans
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
