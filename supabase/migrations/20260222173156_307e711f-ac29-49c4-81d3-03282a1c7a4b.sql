
-- Settings table (key-value pairs)
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Message templates table
CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  type text NOT NULL,
  subject text,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel, type)
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('instagram_daily_target', '30'),
  ('whatsapp_daily_target', '20'),
  ('email_daily_target', '15'),
  ('days_wa_after_insta', '3'),
  ('days_email_after_wa', '2'),
  ('days_insta_followup', '5'),
  ('days_wa_followup', '3'),
  ('days_email_followup', '4'),
  ('days_exhausted', '17'),
  ('days_reengagement', '30'),
  ('claim_link_base', 'https://www.cartevent.com/claim/'),
  ('admin_name', 'Ankit Kumar'),
  ('company_name', 'CartEvent');

-- Insert default message templates
INSERT INTO public.message_templates (channel, type, subject, body) VALUES
  ('instagram', 'initial_1', NULL, 'Hi {name}! Your {category} work is stunning. We''re building CartEvent — a free platform where event vendors in {city} get leads & direct bookings. No upfront cost, just 5% on successful bookings. Join 500+ vendors — takes 30 seconds: {claim_link}'),
  ('instagram', 'initial_2', NULL, 'Hey {name}! Love your {category} portfolio. CartEvent is a new platform helping {city} event vendors get more bookings — completely free to join. You only pay when you earn. Claim your profile here: {claim_link}'),
  ('instagram', 'initial_3', NULL, 'Hi {name}! We came across your amazing {category} work in {city}. We''d love to feature you on CartEvent — it''s a free vendor marketplace where customers find and book event pros directly. Set up your profile in 30 sec: {claim_link}'),
  ('instagram', 'initial_4', NULL, 'Hey {name}! Your work caught our eye. CartEvent helps {category}s in {city} get discovered by thousands of customers looking for event services. Free to list, no commitments. Check it out: {claim_link}'),
  ('instagram', 'followup', NULL, 'Hi {name}! Just following up — we''d love to have your {category} business on CartEvent. It''s completely free and vendors are already getting inquiries. Claim your profile: {claim_link}'),
  ('whatsapp', 'initial_1', NULL, 'Hi {name}! 👋 We found your {category} business in {city} and we''re impressed. CartEvent is a free platform where vendors like you get direct bookings from customers. No listing fee — you only pay 5% when you earn. Takes 30 sec to join: {claim_link}'),
  ('whatsapp', 'initial_2', NULL, 'Hey {name}! CartEvent is helping {category}s in {city} get more event bookings. Free to join, thousands of customers searching every month. Claim your profile: {claim_link}'),
  ('whatsapp', 'initial_3', NULL, 'Hi {name}! Quick question — are you open to getting more {category} bookings in {city}? CartEvent is a free vendor marketplace. 500+ vendors already on board. Check it out: {claim_link}'),
  ('whatsapp', 'initial_4', NULL, 'Hey {name}! We''re reaching out to top {category}s in {city}. CartEvent is a free platform where customers find and book event vendors directly. Would love to have you: {claim_link}'),
  ('whatsapp', 'followup', NULL, 'Hi {name}! Just checking if you saw our message about CartEvent. It''s completely free for {category}s. Happy to answer any questions! 🙂 {claim_link}'),
  ('email', 'initial_1', 'Free listing for your {category} business on CartEvent', 'Hi {name},

I came across your {category} business in {city} and wanted to reach out.

We''re building CartEvent (cartevent.com) — a platform where customers search and book event vendors directly. Think of it as a marketplace specifically for the events industry.

Here''s what makes it worth checking out:
• Free to list — no subscription, no upfront cost
• You only pay 5% on successful bookings
• 500+ vendors already on board, with customers searching daily

Setting up your profile takes 30 seconds:
{claim_link}

Happy to answer any questions!

Best,
Ankit Kumar
CartEvent
cartevent.com'),
  ('email', 'initial_2', '{name}, get more bookings through CartEvent (free)', 'Hi {name},

I came across your {category} business in {city} and wanted to reach out.

We''re building CartEvent (cartevent.com) — a platform where customers search and book event vendors directly.

Here''s what makes it worth checking out:
• Free to list — no subscription, no upfront cost
• You only pay 5% on successful bookings
• 500+ vendors already on board

Setting up your profile takes 30 seconds:
{claim_link}

Best,
Ankit Kumar
CartEvent'),
  ('email', 'initial_3', 'Invitation: Join 500+ event vendors on CartEvent', 'Hi {name},

I came across your {category} business in {city} and wanted to reach out.

CartEvent is a free marketplace for event vendors. 500+ vendors are already getting bookings through us.

Join here (30 seconds): {claim_link}

Best,
Ankit Kumar
CartEvent'),
  ('email', 'initial_4', 'Your {category} business deserves more visibility, {name}', 'Hi {name},

Your {category} work in {city} caught our attention.

CartEvent is a free platform helping event vendors get discovered by customers. No subscription, just 5% on successful bookings.

Claim your profile: {claim_link}

Best,
Ankit Kumar
CartEvent'),
  ('email', 'followup', 'Following up: Free listing on CartEvent for {name}', 'Hi {name},

Just wanted to make sure you saw my earlier email about CartEvent. We''re a free platform helping {category}s in {city} get more bookings.

It takes 30 seconds to set up your profile: {claim_link}

Happy to answer any questions!

Best,
Ankit Kumar
CartEvent'),
  ('instagram', 'reengagement', NULL, 'Hi {name}! We reached out a while back about listing your {category} business on CartEvent. Since then, we''ve grown to 500+ vendors with customers actively booking. Would love to have you on board — it''s still completely free: {claim_link}'),
  ('whatsapp', 'reengagement', NULL, 'Hi {name}! We reached out a while back about listing your {category} business on CartEvent. Since then, we''ve grown to 500+ vendors with customers actively booking. Would love to have you on board — it''s still completely free: {claim_link}'),
  ('email', 'reengagement', 'We''d still love to have you on CartEvent, {name}', 'Hi {name},

We reached out a while back about listing your {category} business on CartEvent. Since then, we''ve grown to 500+ vendors with customers actively booking.

Would love to have you on board — it''s still completely free: {claim_link}

Best,
Ankit Kumar
CartEvent');
