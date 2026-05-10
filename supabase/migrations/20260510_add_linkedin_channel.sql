-- Add LinkedIn channel support to vendors table
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS has_linkedin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS linkedin_handle TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS linkedin_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_message TEXT;

-- Add index for LinkedIn filtering
CREATE INDEX IF NOT EXISTS idx_vendors_has_linkedin ON vendors (has_linkedin) WHERE has_linkedin = TRUE;
CREATE INDEX IF NOT EXISTS idx_vendors_linkedin_status ON vendors (linkedin_status) WHERE has_linkedin = TRUE;

-- Add LinkedIn daily target to settings (if not exists)
INSERT INTO settings (key, value)
VALUES ('linkedin_daily_target', '20')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('days_linkedin_followup', '5')
ON CONFLICT (key) DO NOTHING;
