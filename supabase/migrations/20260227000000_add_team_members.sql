-- Team members table for multi-user support
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to team_members"
  ON public.team_members FOR ALL USING (true) WITH CHECK (true);

-- Add user_id to outreach_log (nullable for backward compat with existing logs)
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.team_members(id);

-- Seed the admin user
INSERT INTO public.team_members (name, email, password, role)
VALUES ('Animesh Kumar', 'admin@cartevent.com', 'admin123', 'admin');
