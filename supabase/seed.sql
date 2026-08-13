-- ---------------------------------------------------------------
-- Local development seed
--
-- Replayed by `supabase db reset` AFTER migrations, so ordering is:
-- schema -> auth globals -> this file. Everything here must be
-- idempotent: re-running must produce the same state.
--
-- All accounts are pre-confirmed (email_confirmed_at set) so the app's
-- email flow never blocks local sign-in. Passwords are dev-only and
-- never real credentials:
--
--   shared dev password: dev-password-123
--
--   attendee@example.com    (attendee)  x2  no invited_role (default)
--   facilitator@example.com (facilitator)   invited_role=facilitator
--   speaker@example.com     (speaker)       invited_role=speaker
--   admin@example.com       (admin)         invited_role=admin
--   superadmin@example.com  (super_admin)   NO invited_role
--
-- super_admin is deliberately excluded from INVITABLE_ROLES
-- (src/modules/auth/lib/invited-role.ts), so ensureUser can never
-- re-assert it on sign-in; the seeded row keeps super_admin until the
-- user signs in, after which the app falls back to attendee. That is an
-- app limitation, not a seed bug — documented here so it is not
-- "fixed" by teaching the seed to lie in app_metadata.
-- ---------------------------------------------------------------

-- Attendee #1 -- attendee@example.com
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'attendee@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{}', '{"full_name":"Alex Attendee"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Alex Attendee', 'attendee@example.com',
  '00000000-0000-4000-8000-000000000001', 'attendee'
) ON CONFLICT (auth_user_id) DO NOTHING;

-- Attendee #2 -- attendee2@example.com
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'attendee2@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{}', '{"full_name":"Bri Attendee"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Bri Attendee', 'attendee2@example.com',
  '00000000-0000-4000-8000-000000000002', 'attendee'
) ON CONFLICT (auth_user_id) DO NOTHING;

-- Facilitator -- facilitator@example.com
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'facilitator@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{"invited_role":"facilitator"}', '{"full_name":"Casey Facilitator"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Casey Facilitator', 'facilitator@example.com',
  '00000000-0000-4000-8000-000000000003', 'facilitator'
) ON CONFLICT (auth_user_id) DO NOTHING;

-- Speaker -- speaker@example.com
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000004',
  'authenticated', 'authenticated', 'speaker@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{"invited_role":"speaker"}', '{"full_name":"Dana Speaker"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Dana Speaker', 'speaker@example.com',
  '00000000-0000-4000-8000-000000000004', 'speaker'
) ON CONFLICT (auth_user_id) DO NOTHING;

-- Admin -- admin@example.com
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000005',
  'authenticated', 'authenticated', 'admin@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{"invited_role":"admin"}', '{"full_name":"Riley Admin"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Riley Admin', 'admin@example.com',
  '00000000-0000-4000-8000-000000000005', 'admin'
) ON CONFLICT (auth_user_id) DO NOTHING;

-- Super admin -- superadmin@example.com (NO invited_role: see header)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000006',
  'authenticated', 'authenticated', 'superadmin@example.com',
  extensions.crypt('dev-password-123', extensions.gen_salt('bf')),
  now(), '', '', '', '', '{}', '{"full_name":"Sam Superadmin"}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."USER" (
  full_name, email, auth_user_id, role
) VALUES (
  'Sam Superadmin', 'superadmin@example.com',
  '00000000-0000-4000-8000-000000000006', 'super_admin'
) ON CONFLICT (auth_user_id) DO NOTHING;
-- ---------------------------------------------------------------
-- Content seed — course, events, speakers, community links
--
-- Fixed numeric ids below are safe: after the inserts we setval() every
-- sequence past the max seeded id so future app-created rows never
-- collide. USER ids are NOT fixed (sequence-assigned), so facilitator /
-- speaker / admin rows are referenced by subselect on auth_user_id.
-- ---------------------------------------------------------------

-- Active event (published, priced) — event id 1
INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES (
  1, 'Product Summit 2026', CURRENT_DATE + 14, '09:00:00', '17:00:00',
  'StartupLab HQ', '123 Innovation Drive, Manila',
  'A day of product thinking, workshops, and talks.',
  500.00, 'PHP', 'active', false
) ON CONFLICT (id) DO NOTHING;

-- Draft event (unpublished) — event id 2
INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES (
  2, 'Community Meetup (Draft)', CURRENT_DATE + 30, '18:00:00', '20:30:00',
  'TBD', NULL, 'A casual evening for the community.', 0.00, 'PHP', 'draft', false
) ON CONFLICT (id) DO NOTHING;

-- Course owned by the active event (COURSE.event_id is UNIQUE) — course id 1
INSERT INTO public."COURSE" (
  id, event_id, course_name, course_description
) OVERRIDING SYSTEM VALUE VALUES  (
  1, 1, 'Intro to Product', 'The baseline course for the Product Summit track.'
) ON CONFLICT (id) DO NOTHING;

-- Modules — ids 1-2
INSERT INTO public."MODULE" (
  id, course_id, module_name, sequence_order, module_type, is_locked
) OVERRIDING SYSTEM VALUE VALUES 
  (1, 1, 'Foundations', 1, 'lessons', false),
  (2, 1, 'Building', 2, 'lessons', false)
ON CONFLICT (id) DO NOTHING;

-- Lessons — ids 1-4 (2 per module)
INSERT INTO public."LESSON" (
  id, module_id, description, content_type, content_url, sequence_order
) OVERRIDING SYSTEM VALUE VALUES 
  (1, 1, 'Welcome video', 'video', 'https://example.com/welcome.mp4', 1),
  (2, 1, 'Reading: intro deck', 'pdf', 'https://example.com/intro.pdf', 2),
  (3, 2, 'Product walkthrough', 'video', 'https://example.com/walkthrough.mp4', 1),
  (4, 2, 'Resources', 'link', 'https://example.com/resources', 2)
ON CONFLICT (id) DO NOTHING;

-- Speaker profile for the seeded speaker user — profile id 1
INSERT INTO public."SPEAKER_PROFILE" (
  id, user_id, bio, designation, linkedin_url, website_url
) OVERRIDING SYSTEM VALUE VALUES  (
  1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000004'),
  'Product leader sharing how great teams ship.',
  'Principal Product Manager',
  'https://linkedin.com/in/dana-speaker',
  'https://example.com/dana'
) ON CONFLICT (id) DO NOTHING;

-- Facilitator assignment on the active event
INSERT INTO public."EVENT_FACILITATOR" (event_id, user_id, assigned_by)
VALUES (
  1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')
) ON CONFLICT (event_id, user_id) DO NOTHING;

-- Speaker assignment on the active event
INSERT INTO public."EVENT_SPEAKER" (event_id, speaker_profile_id)
VALUES (1, 1)
ON CONFLICT (event_id, speaker_profile_id) DO NOTHING;

-- Community links (site-global, shown on /community) — ids 1-2
INSERT INTO public."COMMUNITY_LINK" (
  id, label, url, description, sequence_order, created_by
) OVERRIDING SYSTEM VALUE VALUES 
  (1, 'Community Discord', 'https://discord.example.com',
   'Real-time chat for members.', 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')),
  (2, 'LinkedIn Group', 'https://linkedin.example.com',
   'Professional network group.', 2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'))
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Commerce: one paid ticket for the active event (Alex Attendee),
-- and a pending payment (Bri Attendee) to exercise resume/checkout.
-- gateway_reference_id and qr_token are UNIQUE, so both are guarded.
-- ---------------------------------------------------------------

-- Paid payment for the active event by attendee #1 — payment id 1
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES (
  1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
  1, 'dev-pay-0001', 'paid', now(), 500.00, 'PHP'
) ON CONFLICT (gateway_reference_id) DO NOTHING;

-- Issued ticket for attendee #1 — ticket id 1
INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status
) OVERRIDING SYSTEM VALUE VALUES (
  1, 1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
  1, 'dev-ticket-prodsummit-alex', 'issued'
) ON CONFLICT (qr_token) DO NOTHING;

-- Pending payment (no ticket) by attendee #2 to exercise the
-- resume-pending and checkout paths — payment id 2
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, amount, currency
) OVERRIDING SYSTEM VALUE VALUES (
  2,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
  1, 'dev-pay-0002', 'pending', 500.00, 'PHP'
) ON CONFLICT (gateway_reference_id) DO NOTHING;

-- ---------------------------------------------------------------
-- Survey: one open survey for the active event with an unsent,
-- unsubmitted response for the ticketed attendee (Alex). Sent_at is
-- recent so the response's token URL opens inside the app's 14-day
-- window; the staff "send survey" page sees it as a pending recipient.
-- ---------------------------------------------------------------

INSERT INTO public."SURVEY" (
  id, event_id, sent_at
) OVERRIDING SYSTEM VALUE VALUES (
  1, 1, now()
) ON CONFLICT (id) DO NOTHING;

-- Only ticket holders receive a survey; Bri has a pending payment but
-- no ticket, so just Alex gets a response row.
INSERT INTO public."SURVEY_RESPONSE" (
  id, survey_id, user_id, token
) OVERRIDING SYSTEM VALUE VALUES (
  1, 1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
  'dev-survey-prodsummit-alex'
) ON CONFLICT (token) DO NOTHING;

-- ---------------------------------------------------------------
-- Audit log: a sample check-in so the staff audit page has one row.
-- ---------------------------------------------------------------

INSERT INTO public."AUDIT_LOG" (
  id, actor_id, action, entity_type, entity_id, metadata
) OVERRIDING SYSTEM VALUE VALUES (
  1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
  'checkin.performed', 'ticket', 1,
  '{"method":"manual"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Storage: the four buckets the app uploads to, mirroring BUCKET_CONFIG
-- in src/shared/integrations/storage/policy.ts. That file is the single
-- source of truth — if mime types or the 50MB cap change, change both.
-- ---------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('event_images', 'event_images', true, 52428800,
   ARRAY['image/jpeg', 'image/png']),
  ('profile_images', 'profile_images', true, 52428800,
   ARRAY['image/jpeg', 'image/png']),
  ('course_assets', 'course_assets', false, 52428800,
   ARRAY['application/pdf', 'image/jpeg', 'image/png',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/plain', 'application/zip']),
  ('course_videos', 'course_videos', false, 52428800,
   ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'])
ON CONFLICT (id) DO NOTHING;

-- Keep sequences ahead of seeded ids so app-created rows cannot collide.
SELECT setval(pg_get_serial_sequence('public."EVENT"', 'id'), 2, true);
SELECT setval(pg_get_serial_sequence('public."COURSE"', 'id'), 1, true);
SELECT setval(pg_get_serial_sequence('public."MODULE"', 'id'), 2, true);
SELECT setval(pg_get_serial_sequence('public."LESSON"', 'id'), 4, true);
SELECT setval(pg_get_serial_sequence('public."SPEAKER_PROFILE"', 'id'), 1, true);
SELECT setval(pg_get_serial_sequence('public."COMMUNITY_LINK"', 'id'), 2, true);
SELECT setval(pg_get_serial_sequence('public."PAYMENT"', 'id'), 2, true);
SELECT setval(pg_get_serial_sequence('public."TICKET"', 'id'), 1, true);
SELECT setval(pg_get_serial_sequence('public."SURVEY"', 'id'), 1, true);
SELECT setval(pg_get_serial_sequence('public."SURVEY_RESPONSE"', 'id'), 1, true);
SELECT setval(pg_get_serial_sequence('public."AUDIT_LOG"', 'id'), 1, true);
