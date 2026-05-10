-- Add LinkedIn message templates
INSERT INTO message_templates (channel, type, body, subject, is_active)
VALUES
  ('linkedin', 'initial', 'Hi {name},

I came across your {category} work and wanted to reach out. We''re building CartEvent — a platform connecting event vendors with customers looking to book services in {city}.

75+ vendors joined in Bangalore within 15 days of launch.

We''d love to have you on board. It''s completely free:
{claim_link}

Happy to answer any questions!

– {sender_name}', NULL, true),

  ('linkedin', 'initial_2', 'Hi {name},

We''re inviting select {category}s in {city} to join CartEvent — a fast-growing event booking platform.

You''ve been selected based on your profile. 75+ vendors already onboard.

Activate your free profile here:
{claim_link}

Let me know if you have any questions!

– {sender_name}', NULL, true),

  ('linkedin', 'followup', 'Hi {name},

Just following up on my earlier message. Would love to have you on CartEvent — it''s free and vendors are already getting leads and bookings.

Your activation link:
{claim_link}

Let me know if you have any questions!

– {sender_name}', NULL, true),

  ('linkedin', 'final_followup', 'Hi {name},

We''re closing this batch of {category} onboarding in {city}. If you''d like to be included:

{claim_link}

Last chance for priority visibility!

– {sender_name}', NULL, true),

  ('linkedin', 're_engagement', 'Hi {name},

We reached out a while back about listing your {category} business on CartEvent. Since then, we''ve grown to 500+ vendors with customers actively booking.

Would love to have you on board — it''s still completely free:
{claim_link}

– {sender_name}', NULL, true)

ON CONFLICT DO NOTHING;
