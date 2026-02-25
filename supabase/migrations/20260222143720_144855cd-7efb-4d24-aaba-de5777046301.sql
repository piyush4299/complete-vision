
-- Add new columns to vendors table for multi-channel support
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS insta_message text,
  ADD COLUMN IF NOT EXISTS whatsapp_message text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS has_instagram boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insta_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS overall_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS insta_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Migrate existing data: copy message to insta_message, status to insta_status, date_contacted to insta_contacted_at
UPDATE public.vendors SET 
  insta_message = message,
  insta_status = status,
  insta_contacted_at = date_contacted,
  has_instagram = true
WHERE username IS NOT NULL AND username != '';

-- Make username nullable (can have phone/email-only vendors)
ALTER TABLE public.vendors ALTER COLUMN username DROP NOT NULL;

-- Create unique partial indexes for each identifier
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_username_unique ON public.vendors (username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_phone_unique ON public.vendors (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_email_unique ON public.vendors (email) WHERE email IS NOT NULL;

-- Add enriched column to uploads table
ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS enriched integer NOT NULL DEFAULT 0;

-- Create outreach_log table
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  channel text NOT NULL,
  action text NOT NULL,
  message_sent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on outreach_log"
  ON public.outreach_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger for vendors
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
