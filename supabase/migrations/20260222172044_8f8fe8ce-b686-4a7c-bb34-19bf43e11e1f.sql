
-- Add missing columns to vendors table
ALTER TABLE public.vendors 
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_channel text;

-- Create paused_sessions table for session pause/resume
CREATE TABLE public.paused_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  is_follow_up boolean NOT NULL DEFAULT false,
  vendor_ids jsonb NOT NULL,
  current_index integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  filter_cat text NOT NULL DEFAULT 'all',
  filter_city text NOT NULL DEFAULT 'all',
  batch_size integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed - this is an internal admin tool
ALTER TABLE public.paused_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to paused_sessions" ON public.paused_sessions FOR ALL USING (true) WITH CHECK (true);
