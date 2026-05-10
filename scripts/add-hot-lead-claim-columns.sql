-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Adds columns to support the "claim a hot lead" feature

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS hot_lead_claimed_by TEXT DEFAULT NULL;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS hot_lead_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: Add an index for faster filtering on the hot leads page
CREATE INDEX IF NOT EXISTS idx_vendors_hot_lead_claimed
  ON vendors (hot_lead_claimed_by)
  WHERE overall_status = 'interested';
