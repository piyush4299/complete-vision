
-- Create uploads table
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  total_in_file INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  new_added INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  claim_link TEXT NOT NULL DEFAULT '',
  profile_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  date_contacted TIMESTAMP WITH TIME ZONE,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Since this is a personal internal tool with no auth, allow all operations
CREATE POLICY "Allow all operations on uploads" ON public.uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_vendors_username ON public.vendors(username);
CREATE INDEX idx_vendors_status ON public.vendors(status);
CREATE INDEX idx_vendors_category ON public.vendors(category);
CREATE INDEX idx_vendors_city ON public.vendors(city);
