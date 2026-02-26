-- Per-user message templates: NULL user_id = global (admin default), set user_id = agent-specific
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.team_members(id);

-- Replace the old unique constraint (channel, type) with one that includes user_id
-- so each agent can have their own copy of every template
ALTER TABLE public.message_templates DROP CONSTRAINT IF EXISTS message_templates_channel_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS message_templates_channel_type_user_idx
  ON public.message_templates (channel, type, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
