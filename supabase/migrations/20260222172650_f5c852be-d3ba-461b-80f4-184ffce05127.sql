
-- Create vendor_sequences table for multi-channel sequence tracking
CREATE TABLE public.vendor_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  sequence_type text NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  steps jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(vendor_id)
);

ALTER TABLE public.vendor_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to vendor_sequences" ON public.vendor_sequences FOR ALL USING (true) WITH CHECK (true);
