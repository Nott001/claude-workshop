-- ---------------------------------------------------------------
-- Local development seed
--
-- Replayed by `supabase db reset` AFTER migrations, so ordering is:
-- schema -> auth globals -> this file. Everything here must be
-- idempotent: re-running must produce the same state.
--
-- Two kinds of accounts exist:
--
--   * Sign-in accounts (auth.users + USER) — the small set the app's
--     email flow never blocks because they are pre-confirmed
--     (email_confirmed_at set). Passwords are dev-only:
--
--       shared dev password: dev-password-123
--
--       attendee@example.com    (attendee)  x2  no invited_role (default)
--       facilitator@example.com (facilitator)   invited_role=facilitator
--       speaker@example.com     (speaker)       invited_role=speaker
--       admin@example.com       (admin)         invited_role=admin
--       superadmin@example.com  (super_admin)   NO invited_role
--
--     super_admin is deliberately excluded from INVITABLE_ROLES
--     (src/modules/auth/lib/invited-role.ts), so ensureUser can never
--     re-assert it on sign-in; the seeded row keeps super_admin until the
--     user signs in, after which the app falls back to attendee. That is an
--     app limitation, not a seed bug — documented here so it is not
--     "fixed" by teaching the seed to lie in app_metadata.
--
--   * Background users (USER rows only, synthetic auth_user_id UUIDs,
--     no auth.users) — they fill attendee lists, tickets, payments, chat
--     and survey responses so the app looks like prod, but they can never
--     sign in. They are referenced by subselect on auth_user_id exactly
--     like the sign-in users, so nothing here needs to know their numeric
--     USER ids.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- Sign-in accounts
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
-- Background users (USER rows only, no auth.users — see header)
-- ---------------------------------------------------------------

INSERT INTO public."USER" (full_name, email, auth_user_id, role) VALUES
  ('Jose Reyes',        'jose.reyes@example.com',       '00000000-0000-4000-8000-000000000101', 'attendee'),
  ('Liwanag Santos',    'liwanag.santos@example.com',    '00000000-0000-4000-8000-000000000102', 'attendee'),
  ('Miguel Cruz',       'miguel.cruz@example.com',       '00000000-0000-4000-8000-000000000103', 'attendee'),
  ('Bea Garcia',        'bea.garcia@example.com',        '00000000-0000-4000-8000-000000000104', 'attendee'),
  ('Carlo Mendoza',     'carlo.mendoza@example.com',     '00000000-0000-4000-8000-000000000105', 'attendee'),
  ('Ana Villanueva',    'ana.villanueva@example.com',    '00000000-0000-4000-8000-000000000106', 'attendee'),
  ('Ria Torres',        'ria.torres@example.com',        '00000000-0000-4000-8000-000000000107', 'attendee'),
  ('Ken Bautista',      'ken.bautista@example.com',      '00000000-0000-4000-8000-000000000108', 'attendee'),
  ('Sam Dela Cruz',     'sam.delacruz@example.com',      '00000000-0000-4000-8000-000000000109', 'attendee'),
  ('Nina Ramos',        'nina.ramos@example.com',        '00000000-0000-4000-8000-000000000110', 'attendee'),
  ('Paolo Aquino',      'paolo.aquino@example.com',      '00000000-0000-4000-8000-000000000111', 'attendee'),
  ('Mei Lim',           'mei.lim@example.com',           '00000000-0000-4000-8000-000000000112', 'attendee'),
  ('Priya Sharma',      'priya.sharma@example.com',      '00000000-0000-4000-8000-000000000201', 'speaker'),
  ('Marcus Lee',        'marcus.lee@example.com',        '00000000-0000-4000-8000-000000000202', 'speaker'),
  ('Tasha Constantine', 'tasha.constantine@example.com', '00000000-0000-4000-8000-000000000203', 'facilitator'),
  ('Diego Fernandez',   'diego.fernandez@example.com',   '00000000-0000-4000-8000-000000000204', 'facilitator')
ON CONFLICT (auth_user_id) DO NOTHING;

-- ---------------------------------------------------------------
-- Content seed — course, events, speakers, community links
--
-- Fixed numeric ids below are safe: after the inserts we setval() every
-- sequence past the max seeded id so future app-created rows never
-- collide. USER ids are NOT fixed (sequence-assigned), so every user is
-- referenced by subselect on auth_user_id.
--
-- Event timing is relative to CURRENT_DATE so the mix stays realistic on
-- any day: past events keep status 'active' with dates whose end edge has
-- passed, which is exactly how prod rows look — effectiveEventStatus in
-- src/shared/db/dao/helpers.ts derives them as 'complete' on read.
-- ---------------------------------------------------------------

-- Kept events: Product Summit 2026 (active, nearest upcoming) and the
-- draft Community Meetup.
INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Product Summit 2026', CURRENT_DATE + 14, '09:00:00', '17:00:00',
   'StartupLab HQ', '123 Innovation Drive, Manila',
   'A day of product thinking, workshops, and talks.',
   500.00, 'PHP', 'active', false),
  (2, 'Community Meetup (Draft)', CURRENT_DATE + 30, '18:00:00', '20:30:00',
   'TBD', NULL, 'A casual evening for the community.', 0.00, 'PHP', 'draft', false)
ON CONFLICT (id) DO NOTHING;

-- Past events
INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES
  (3, 'Rust Hack Night',        CURRENT_DATE - 45,  '18:30:00', '21:00:00',
   'Hackerspace Manila', '88 Quezon Avenue, Quezon City',
   'An evening of hands-on Rust: ownership, borrow checker, and small systems projects.', 0.00, 'PHP', 'active', true),
  (4, 'Startup Weekend Manila', CURRENT_DATE - 120, '09:00:00', '18:00:00',
   'Fintech Tower', 'Ayala Avenue, Makati',
   'Fifty-four hours to pitch, build, and launch a startup in front of local investors.', 250.00, 'PHP', 'active', false),
  (5, 'Design Systems Day',     CURRENT_DATE - 200, '09:00:00', '17:00:00',
   'Arc Event Center', 'BGC, Taguig',
   'A conference on tokens, component libraries, and accessibility at scale.', 800.00, 'PHP', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- Upcoming events (id 1 stays the nearest upcoming; see landing query limit)
INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES
  (6, 'AI/ML Meetup', CURRENT_DATE + 60, '18:30:00', '21:00:00',
   'Edge Labs', 'Commonwealth Avenue, Quezon City',
   'A casual meetup on applied machine learning with local practitioners.', 0.00, 'PHP', 'active', false)
ON CONFLICT (id) DO NOTHING;

-- Course owned by the active event (COURSE.event_id is UNIQUE) — course id 1
INSERT INTO public."COURSE" (
  id, event_id, course_name, course_description
) OVERRIDING SYSTEM VALUE VALUES  (
  1, 1, 'Intro to Product', 'The baseline course for the Product Summit track.'
) ON CONFLICT (id) DO NOTHING;

-- Course for the past Rust event so course history and QA have a home
INSERT INTO public."COURSE" (
  id, event_id, course_name, course_description
) OVERRIDING SYSTEM VALUE VALUES (
  2, 3, 'Rust Fundamentals', 'The course that accompanied the Rust Hack Night.'
) ON CONFLICT (id) DO NOTHING;

-- Modules — ids 1-2 (course 1), ids 3-4 (course 2). Sessions sit inside
-- their event day: Product Summit runs 09:00-17:00, Rust Hack Night
-- 18:30-21:00.
INSERT INTO public."MODULE" (
  id, course_id, module_name, sequence_order, module_type, is_locked, start_time, end_time
) OVERRIDING SYSTEM VALUE VALUES 
  (1, 1, 'Foundations', 1, 'lessons', false, '09:00:00', '11:30:00'),
  (2, 1, 'Building', 2, 'lessons', false, '13:00:00', '16:30:00'),
  (3, 2, 'Ownership & Safety', 1, 'lessons', false, '18:30:00', '19:45:00'),
  (4, 2, 'Systems Rust', 2, 'lessons', false, '19:45:00', '21:00:00')
ON CONFLICT (id) DO NOTHING;

-- Lessons — ids 1-10 (course 1), ids 11-18 (course 2). Descriptions are
-- optional; a spread of them (and a few NULLs) keeps the room card and
-- builder realistic.
INSERT INTO public."LESSON" (
  id, module_id, name, description, content_type, content_url, sequence_order
) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Welcome video', 'A quick hello and a map of the week ahead.', 'video', 'https://example.com/welcome.mp4', 1),
  (2, 1, 'Reading: intro deck', 'The slide deck that frames the course core ideas.', 'pdf', 'https://example.com/intro.pdf', 2),
  (3, 1, 'Product glossary', 'The terms we lean on all course long.', 'link', 'https://example.com/glossary', 3),
  (4, 1, 'The product canvas', NULL, 'image', 'https://example.com/product-canvas.png', 4),
  (5, 1, 'What makes a product', 'A 15-minute primer on problem framing and fit.', 'video', 'https://example.com/what-makes-a-product.mp4', 5),
  (6, 2, 'Product walkthrough', 'A recorded walkthrough of the summit demo build.', 'video', 'https://example.com/walkthrough.mp4', 1),
  (7, 2, 'Resources', NULL, 'link', 'https://example.com/resources', 2),
  (8, 2, 'Building a backlog', 'Turn attendee feedback into a prioritised backlog.', 'pdf', 'https://example.com/backlog.pdf', 3),
  (9, 2, 'Wireframing basics', 'A low-fi wireframe gallery for the group exercises.', 'image', 'https://example.com/wireframes.png', 4),
  (10, 2, 'Prototype review', 'A review session on an early prototype.', 'video', 'https://example.com/prototype-review.mp4', 5),
  (11, 3, 'Memory model intro', 'How values live and die on the stack and the heap.', 'pdf', 'https://example.com/memory-model.pdf', 1),
  (12, 3, 'Borrow checker demo', 'The borrow checker, explained by breaking code on purpose.', 'video', 'https://example.com/borrow-checker.mp4', 2),
  (13, 3, 'Ownership in practice', NULL, 'link', 'https://example.com/ownership', 3),
  (14, 3, 'Lifetimes cheat sheet', 'A one-page reference for the common lifetime patterns.', 'image', 'https://example.com/lifetimes.png', 4),
  (15, 4, 'Concurrency patterns', 'Channels, Arc, and knowing when each fits.', 'link', 'https://example.com/concurrency', 1),
  (16, 4, 'Building a small CLI', 'A walkthrough of a tiny real-world CLI.', 'video', 'https://example.com/cli.mp4', 2),
  (17, 4, 'Error handling in Rust', NULL, 'pdf', 'https://example.com/error-handling.pdf', 3),
  (18, 4, 'Zero-cost abstractions', 'What "zero-cost" actually means for iterators.', 'video', 'https://example.com/zero-cost.mp4', 4)
ON CONFLICT (id) DO NOTHING;

-- Speaker profiles: id 1 (sign-in speaker Dana), ids 2-3 (background)
INSERT INTO public."SPEAKER_PROFILE" (
  id, user_id, bio, designation, linkedin_url, website_url
) OVERRIDING SYSTEM VALUE VALUES  (
  1,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000004'),
  'Product leader sharing how great teams ship.',
  'Principal Product Manager',
  'https://linkedin.com/in/dana-speaker',
  'https://example.com/dana'
),
  (
  2,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000201'),
  'Applied ML engineer; teaches model serving the hard way.',
  'Senior ML Engineer',
  'https://linkedin.com/in/priya-sharma',
  NULL
),
  (
  3,
  (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000202'),
  'Design systems lead who argues with your linter daily.',
  'Frontend Architect',
  'https://linkedin.com/in/marcus-lee',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Facilitator assignments
INSERT INTO public."EVENT_FACILITATOR" (event_id, user_id, assigned_by)
VALUES
  (1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')),
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000203'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000204'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005')),
  (6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'))
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Speaker assignments
INSERT INTO public."EVENT_SPEAKER" (event_id, speaker_profile_id)
VALUES
  (1, 1),
  (1, 3),
  (3, 2),
  (4, 1),
  (4, 2),
  (6, 2),
  (6, 3)
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
-- Commerce. gateway_reference_id and qr_token are UNIQUE, so every
-- payment/ticket insert is guarded on its own unique key.
--
-- Past events carry the full lifecycle (issued -> checked_in, and
-- cancelled + refunded, plus failed/pending stragglers); upcoming events
-- show the open states the app renders today. checked_in_at sits on the
-- event day, which is what makes past rows read as real history.
-- ---------------------------------------------------------------

-- Event 3 — Rust Hack Night (45 days ago, free)
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   3, 'dev-pay-0003', 'paid', (CURRENT_DATE - 45) + time '08:50:00', 0.00, 'PHP'),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   3, 'dev-pay-0004', 'paid', (CURRENT_DATE - 45) + time '09:05:00', 0.00, 'PHP'),
  (5,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   3, 'dev-pay-0005', 'paid', (CURRENT_DATE - 45) + time '09:12:00', 0.00, 'PHP'),
  (6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   3, 'dev-pay-0006', 'refunded', (CURRENT_DATE - 46) + time '11:40:00', 0.00, 'PHP'),
  (7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000105'),
   3, 'dev-pay-0007', 'pending', (CURRENT_DATE - 44) + time '14:00:00', 0.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status, checked_in_by, checked_in_at
) OVERRIDING SYSTEM VALUE VALUES
  (2, 3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   3, 'dev-ticket-rust-jose', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000203'),
   (CURRENT_DATE - 45) + time '19:12:00'),
  (3, 4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   3, 'dev-ticket-rust-liwanag', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000203'),
   (CURRENT_DATE - 45) + time '19:20:00'),
  (4, 5,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   3, 'dev-ticket-rust-miguel', 'issued', NULL, NULL),
  (5, 6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   3, 'dev-ticket-rust-bea', 'cancelled', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Event 4 — Startup Weekend Manila (120 days ago, 250 PHP)
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (8,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   4, 'dev-pay-0008', 'paid', (CURRENT_DATE - 121) + time '08:30:00', 250.00, 'PHP'),
  (9,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000107'),
   4, 'dev-pay-0009', 'paid', (CURRENT_DATE - 121) + time '08:44:00', 250.00, 'PHP'),
  (10,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   4, 'dev-pay-0010', 'paid', (CURRENT_DATE - 120) + time '09:00:00', 250.00, 'PHP'),
  (11,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000109'),
   4, 'dev-pay-0011', 'paid', (CURRENT_DATE - 120) + time '09:15:00', 250.00, 'PHP'),
  (12,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   4, 'dev-pay-0012', 'refunded', (CURRENT_DATE - 122) + time '17:20:00', 250.00, 'PHP'),
  (13,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000111'),
   4, 'dev-pay-0013', 'failed', (CURRENT_DATE - 120) + time '09:30:00', 250.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status, checked_in_by, checked_in_at
) OVERRIDING SYSTEM VALUE VALUES
  (6, 8,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   4, 'dev-ticket-sw-an', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (CURRENT_DATE - 120) + time '09:05:00'),
  (7, 9,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000107'),
   4, 'dev-ticket-sw-ria', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (CURRENT_DATE - 120) + time '09:30:00'),
  (8, 10,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   4, 'dev-ticket-sw-ken', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000204'),
   (CURRENT_DATE - 120) + time '10:00:00'),
  (9, 11,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000109'),
   4, 'dev-ticket-sw-sam', 'issued', NULL, NULL),
  (10, 12,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   4, 'dev-ticket-sw-nina', 'cancelled', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Event 5 — Design Systems Day (200 days ago, 800 PHP)
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (14,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   5, 'dev-pay-0014', 'paid', (CURRENT_DATE - 201) + time '08:20:00', 800.00, 'PHP'),
  (15,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   5, 'dev-pay-0015', 'paid', (CURRENT_DATE - 201) + time '08:35:00', 800.00, 'PHP'),
  (16,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   5, 'dev-pay-0016', 'paid', (CURRENT_DATE - 200) + time '08:50:00', 800.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status, checked_in_by, checked_in_at
) OVERRIDING SYSTEM VALUE VALUES
  (11, 14,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   5, 'dev-ticket-dsd-mei', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   (CURRENT_DATE - 200) + time '09:00:00'),
  (12, 15,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   5, 'dev-ticket-dsd-jose', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   (CURRENT_DATE - 200) + time '09:12:00'),
  (13, 16,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   5, 'dev-ticket-dsd-liwanag', 'issued', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Event 1 — Product Summit 2026 (paid ticket for Alex, pending for Bri
-- pre-exist as ids 1-2) — plus a realistic spread of newer bookings.
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (17,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   1, 'dev-pay-0017', 'paid', now(), 500.00, 'PHP'),
  (18,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   1, 'dev-pay-0018', 'paid', now(), 500.00, 'PHP'),
  (19,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   1, 'dev-pay-0019', 'paid', now(), 500.00, 'PHP'),
  (20,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000107'),
   1, 'dev-pay-0020', 'refunded', now() - interval '1 day', 500.00, 'PHP'),
  (21,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   1, 'dev-pay-0021', 'pending', now(), 500.00, 'PHP'),
  (22,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000109'),
   1, 'dev-pay-0022', 'failed', now(), 500.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status
) OVERRIDING SYSTEM VALUE VALUES
  (14, 17,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   1, 'dev-ticket-prodsummit-bea', 'issued'),
  (15, 18,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   1, 'dev-ticket-prodsummit-miguel', 'issued'),
  (16, 19,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   1, 'dev-ticket-prodsummit-an', 'issued'),
  (17, 20,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000107'),
   1, 'dev-ticket-prodsummit-ria', 'cancelled')
ON CONFLICT (id) DO NOTHING;

-- Event 6 — AI/ML Meetup (60 days out, free)
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (23,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   6, 'dev-pay-0023', 'paid', now(), 0.00, 'PHP'),
  (24,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000105'),
   6, 'dev-pay-0024', 'paid', now(), 0.00, 'PHP'),
  (25,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   6, 'dev-pay-0025', 'paid', now(), 0.00, 'PHP'),
  (26,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   6, 'dev-pay-0026', 'pending', now(), 0.00, 'PHP'),
  (27,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000111'),
   6, 'dev-pay-0027', 'failed', now(), 0.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status
) OVERRIDING SYSTEM VALUE VALUES
  (18, 23,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   6, 'dev-ticket-aiml-jose', 'issued'),
  (19, 24,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000105'),
   6, 'dev-ticket-aiml-carlo', 'issued'),
  (20, 25,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   6, 'dev-ticket-aiml-nina', 'issued')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Surveys.
--
-- Survey 1 (event 1) stays the open one: sent recently with an unsent,
-- unsubmitted response for Alex, inside the app's 14-day window.
-- Surveys 2 (Design Systems Day) and 3 (Rust Hack Night) are closed:
-- sent after their events, with a mix of submitted responses (rating +
-- comment) and one sent-but-unsubmitted recipient, so the staff survey
-- page and dashboard show real history.
-- ---------------------------------------------------------------

INSERT INTO public."SURVEY" (
  id, event_id, sent_at
) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, now()),
  (2, 5, (CURRENT_DATE - 193) + time '09:00:00'),
  (3, 3, (CURRENT_DATE - 38) + time '09:00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."SURVEY_RESPONSE" (
  id, survey_id, user_id, token, sent_at, submitted_at, rating, comment
) OVERRIDING SYSTEM VALUE VALUES
  (1, 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   'dev-survey-prodsummit-alex', now(), NULL, NULL, NULL),
  (2, 2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'dev-survey-dsd-jose', (CURRENT_DATE - 193) + time '09:00:00', NULL, NULL, NULL),
  (3, 2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   'dev-survey-dsd-mei', (CURRENT_DATE - 193) + time '09:00:00',
   (CURRENT_DATE - 191) + time '18:22:00', 5, 'Great speakers and workshops.'),
  (4, 2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   'dev-survey-dsd-liwanag', (CURRENT_DATE - 193) + time '09:00:00',
   (CURRENT_DATE - 190) + time '09:00:00', 4, 'Solid lineup; the design-tokens talk was the highlight.'),
  (5, 3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   'dev-survey-rust-miguel', (CURRENT_DATE - 38) + time '09:00:00',
   (CURRENT_DATE - 37) + time '20:14:00', 4, 'Great hands-on session.'),
  (6, 3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   'dev-survey-rust-liwanag', (CURRENT_DATE - 38) + time '09:00:00',
   (CURRENT_DATE - 36) + time '08:40:00', 5, 'The borrow-checker demo finally clicked.')
ON CONFLICT (token) DO NOTHING;

-- ---------------------------------------------------------------
-- Support cases + chat history. case_number comes from a sequence in prod
-- (support_case_seq); the seed supplies explicit values and then advances
-- the sequence past them so the next app-created case does not collide.
-- ---------------------------------------------------------------

INSERT INTO public."SUPPORT_SESSION" (
  id, user_id, status, case_number, support_type, assigned_to, created_at, updated_at
) OVERRIDING SYSTEM VALUE VALUES
  (1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'active', 1001, 'general',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   now() - interval '2 days', now() - interval '2 days'),
  (2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   'active', 1002, 'general',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   now() - interval '5 days', now() - interval '5 days'),
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   'ended_by_facilitator', 1003, 'general',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   now() - interval '20 days', now() - interval '18 days'),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   'ended_by_facilitator', 1004, 'general',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   now() - interval '60 days', now() - interval '58 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."CHAT_MESSAGE" (
  id, user_id, recipient_user_id, message, sent_at, session_id
) OVERRIDING SYSTEM VALUE VALUES
  (1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   'Hi, I cannot load my Rust Hack Night ticket QR.', now() - interval '2 days', 1),
  (2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'Let me look into that — try refreshing the My Tickets page.', now() - interval '2 days' + interval '10 minutes', 1),
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   'It works now, thanks!', now() - interval '1 day', 1),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'My payment shows pending but the charge went through.', now() - interval '5 days', 2),
  (5,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000110'),
   'I can see it on my end; give it a few minutes to settle.', now() - interval '5 days' + interval '15 minutes', 2),
  (6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   'Any update on my refund?', now() - interval '19 days', 3),
  (7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   'Refund processed — check your email for the confirmation.', now() - interval '18 days', 3),
  (8,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'Can I transfer my Startup Weekend ticket to a friend?', now() - interval '59 days', 4),
  (9,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000108'),
   'Not transferable, but we can refund it if you need to.', now() - interval '58 days', 4)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- QA messages, tied to courses so facilitators/speakers of those events
-- can see them. Never an invited_role of super_admin (see header).
-- ---------------------------------------------------------------

INSERT INTO public."QA_MESSAGE" (
  id, event_id, user_id, message, module_id, created_at
) OVERRIDING SYSTEM VALUE VALUES
  (1, 3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   'Can you share the borrow-checker exercise file?', 3, (CURRENT_DATE - 44) + time '20:02:00'),
  (2, 3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   'When does the session recording go up?', 4, (CURRENT_DATE - 44) + time '20:31:00'),
  (3, 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   'Will the course stay available after the event?', 1, now() - interval '1 day'),
  (4, 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   'Is there a group project in the Building module?', 2, now())
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Today: the live QA workshop. This event is deliberately set to
-- CURRENT_DATE with a full-day window (00:00-23:59) so the room reads as
-- live at any hour — realtime (QA messages + the module lock) can be
-- exercised against a room that is genuinely started. Its modules carry a
-- morning-to-early-afternoon session block (09:00-14:30) so the current
-- topic and schedule badges render, but the room itself stays live for the
-- whole day. It carries a course with four modules and a Q&A thread that
-- runs through all of them, plus tickets for the sign-in attendees so
-- either can reach the room.
-- ---------------------------------------------------------------

INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES
  (7, 'Live QA Workshop', CURRENT_DATE, '00:00:00', '23:59:59',
   'StartupLab HQ', '123 Innovation Drive, Manila',
   'A live course room used to exercise realtime QA and the module lock.',
   0.00, 'PHP', 'active', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."COURSE" (
  id, event_id, course_name, course_description
) OVERRIDING SYSTEM VALUE VALUES (
  3, 7, 'Live QA Course', 'Four modules exercised live during the workshop.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public."MODULE" (
  id, course_id, module_name, sequence_order, module_type, is_locked, start_time, end_time
) OVERRIDING SYSTEM VALUE VALUES
  (5, 3, 'Kickoff', 1, 'lessons', false, '09:00:00', '09:45:00'),
  (6, 3, 'Discussion', 2, 'lessons', false, '09:45:00', '10:45:00'),
  (7, 3, 'Working Session', 3, 'lessons', false, '11:00:00', '12:30:00'),
  (8, 3, 'Wrap-up', 4, 'lessons', false, '12:30:00', '13:00:00'),
  (9, 3, 'Open Q&A', 5, 'qa', false, '13:00:00', '14:30:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."LESSON" (
  id, module_id, name, description, content_type, content_url, sequence_order
) OVERRIDING SYSTEM VALUE VALUES
  (19, 5, 'Opening remarks', 'A five-minute hello and a map of the day.', 'video', 'https://example.com/opening.mp4', 1),
  (20, 5, 'Today overview', 'The agenda, live-updated as the day moves.', 'link', 'https://example.com/today-overview', 2),
  (21, 6, 'Icebreaker: quick intros', 'Two minutes each; the room chats in parallel.', 'video', 'https://example.com/icebreaker.mp4', 1),
  (22, 6, 'Discussion guide', 'The prompts the facilitators will pull from.', 'pdf', 'https://example.com/discussion-guide.pdf', 2),
  (23, 7, 'Working session', 'Breakout work, live from the room.', 'video', 'https://example.com/working-session.mp4', 1),
  (24, 7, 'Worksheet', 'The exercise sheet for the session.', 'pdf', 'https://example.com/worksheet.pdf', 2),
  (25, 8, 'Wrap-up and next steps', 'Closing notes and what happens after today.', 'video', 'https://example.com/wrap-up.mp4', 1),
  (26, 8, 'Feedback form', 'One question, thirty seconds.', 'link', 'https://example.com/feedback', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."EVENT_FACILITATOR" (event_id, user_id, assigned_by)
VALUES
  (7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'))
ON CONFLICT (event_id, user_id) DO NOTHING;

INSERT INTO public."EVENT_SPEAKER" (event_id, speaker_profile_id)
VALUES (7, 1)
ON CONFLICT (event_id, speaker_profile_id) DO NOTHING;

-- Tickets so both sign-in attendees can open the room (see room-access
-- policy: non-staff need a valid ticket).
INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (28,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   7, 'dev-pay-0028', 'paid', now(), 0.00, 'PHP'),
  (29,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
   7, 'dev-pay-0029', 'paid', now(), 0.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status
) OVERRIDING SYSTEM VALUE VALUES
  (21, 28,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   7, 'dev-ticket-today-alex', 'issued'),
  (22, 29,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
   7, 'dev-ticket-today-bri', 'issued')
ON CONFLICT (id) DO NOTHING;

-- The Q&A thread lives in the Open Q&A module: an attendee asks, the
-- speaker and facilitator answer, so the panel opens already populated.
INSERT INTO public."QA_MESSAGE" (
  id, event_id, user_id, message, module_id, created_at
) OVERRIDING SYSTEM VALUE VALUES
  (5, 7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   'Will the course materials stay available after today?', 9, now() - interval '95 minutes'),
  (6, 7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000004'),
   'Yes — everything stays up for 30 days after the event.', 9, now() - interval '90 minutes'),
  (7, 7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
   'How are the breakout groups decided for the working session?', 9, now() - interval '60 minutes'),
  (8, 7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   'You stay in your seat; each table is a group.', 9, now() - interval '55 minutes'),
  (9, 7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   'Where does the worksheet for the working session live?', 9, now() - interval '30 minutes'),
   (10, 7,
    (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000004'),
    'It is the Working Session worksheet — grab it before the breakout starts.', 9, now() - interval '25 minutes')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Yesterday: a finished event for testing the survey flow. It ended
-- yesterday, so its 14-day send window is wide open, it is opted into
-- surveys, and both sign-in attendees plus a few background users hold
-- tickets — so the staff Surveys tab can run "Send bulk survey" and the
-- emailed links can be opened by signing in as an attendee. No survey
-- is seeded: the first send creates it, which is the path being tested.
-- ---------------------------------------------------------------

INSERT INTO public."EVENT" (
  id, title, event_date, start_time, end_time, venue_name, venue_address,
  description, price, currency, status, survey_enabled
) OVERRIDING SYSTEM VALUE VALUES
  (8, 'Community Feedback Night', CURRENT_DATE - 1, '18:00:00', '21:00:00',
   'StartupLab HQ', '123 Innovation Drive, Manila',
   'A finished evening for exercising the post-event survey flow.',
   0.00, 'PHP', 'active', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."PAYMENT" (
  id, user_id, event_id, gateway_reference_id, status, paid_at, amount, currency
) OVERRIDING SYSTEM VALUE VALUES
  (30,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   8, 'dev-pay-0030', 'paid', (CURRENT_DATE - 1) + time '18:02:00', 0.00, 'PHP'),
  (31,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
   8, 'dev-pay-0031', 'paid', (CURRENT_DATE - 1) + time '18:07:00', 0.00, 'PHP'),
  (32,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   8, 'dev-pay-0032', 'paid', (CURRENT_DATE - 1) + time '18:15:00', 0.00, 'PHP'),
  (33,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   8, 'dev-pay-0033', 'paid', (CURRENT_DATE - 1) + time '18:21:00', 0.00, 'PHP'),
  (34,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   8, 'dev-pay-0034', 'paid', (CURRENT_DATE - 1) + time '18:30:00', 0.00, 'PHP'),
  (35,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   8, 'dev-pay-0035', 'refunded', (CURRENT_DATE - 1) + time '19:50:00', 0.00, 'PHP')
ON CONFLICT (gateway_reference_id) DO NOTHING;

INSERT INTO public."TICKET" (
  id, payment_id, user_id, event_id, qr_token, status, checked_in_by, checked_in_at
) OVERRIDING SYSTEM VALUE VALUES
  (23, 30,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   8, 'dev-ticket-feedback-alex', 'issued', NULL, NULL),
  (24, 31,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000002'),
   8, 'dev-ticket-feedback-bri', 'issued', NULL, NULL),
  (25, 32,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   8, 'dev-ticket-feedback-jose', 'checked_in',
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   (CURRENT_DATE - 1) + time '19:10:00'),
  (26, 33,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000102'),
   8, 'dev-ticket-feedback-liwanag', 'issued', NULL, NULL),
  (27, 34,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   8, 'dev-ticket-feedback-miguel', 'issued', NULL, NULL),
  (28, 35,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000104'),
   8, 'dev-ticket-feedback-bea', 'cancelled', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Staff invites: a mix of pending / accepted / expired so the staff
-- invite page has realistic rows.
-- ---------------------------------------------------------------

INSERT INTO public."STAFF_INVITE" (
  id, email, full_name, invited_role, event_id, invited_by, status, responded_at
) OVERRIDING SYSTEM VALUE VALUES
  (1, 'eva.navarro@example.com', 'Eva Navarro', 'facilitator', 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'pending', NULL),
  (2, 'marcus.lee@example.com', 'Marcus Lee', 'speaker', 6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'accepted', now() - interval '30 days'),
  (3, 'old.invite@example.com', 'Old Invite', 'admin', 1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'expired', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Email + audit logs. Email rows mirror the commerce/survey activity
-- above; audit rows give the staff audit page history.
-- ---------------------------------------------------------------

INSERT INTO public."EMAIL_LOG" (
  id, user_id, email_type, status, sent_at
) OVERRIDING SYSTEM VALUE VALUES
  (1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000001'),
   'ticket_issued', 'sent', now()),
  (2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'ticket_issued', 'sent', (CURRENT_DATE - 45) + time '08:50:00'),
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'check_in_confirmed', 'sent', (CURRENT_DATE - 45) + time '19:12:00'),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   'ticket_issued', 'sent', (CURRENT_DATE - 121) + time '08:30:00'),
  (5,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000106'),
   'check_in_confirmed', 'sent', (CURRENT_DATE - 120) + time '09:05:00'),
  (6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   'ticket_issued', 'sent', (CURRENT_DATE - 201) + time '08:20:00'),
  (7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000112'),
   'check_in_confirmed', 'sent', (CURRENT_DATE - 200) + time '09:00:00'),
  (8,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000101'),
   'event_survey', 'sent', (CURRENT_DATE - 193) + time '09:00:00'),
  (9,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000103'),
   'event_survey', 'sent', (CURRENT_DATE - 38) + time '09:00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."AUDIT_LOG" (
  id, actor_id, action, entity_type, entity_id, metadata, created_at
) OVERRIDING SYSTEM VALUE VALUES
  (1,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'checkin.performed', 'ticket', 1, '{"method":"manual"}'::jsonb, now()),
  (2,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'event.published', 'event', 3, '{"status":"active"}'::jsonb, (CURRENT_DATE - 46) + time '10:00:00'),
  (3,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'event.published', 'event', 4, '{"status":"active"}'::jsonb, (CURRENT_DATE - 121) + time '11:00:00'),
  (4,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'event.published', 'event', 5, '{"status":"active"}'::jsonb, (CURRENT_DATE - 201) + time '11:30:00'),
  (5,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'event.created', 'event', 6, NULL, now() - interval '12 days'),
  (6,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'event.published', 'event', 6, '{"status":"active"}'::jsonb, now() - interval '10 days'),
  (7,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000203'),
   'checkin.performed', 'ticket', 2, '{"method":"qr_scan"}'::jsonb, (CURRENT_DATE - 45) + time '19:12:00'),
  (8,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000003'),
   'checkin.performed', 'ticket', 6, '{"method":"qr_scan"}'::jsonb, (CURRENT_DATE - 120) + time '09:05:00'),
  (9,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000204'),
   'checkin.performed', 'ticket', 8, '{"method":"manual"}'::jsonb, (CURRENT_DATE - 120) + time '10:00:00'),
  (10,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'checkin.performed', 'ticket', 11, '{"method":"qr_scan"}'::jsonb, (CURRENT_DATE - 200) + time '09:00:00'),
  (11,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'speaker.assigned', 'event', 6, '{"speaker_profile_id":3}'::jsonb, now() - interval '10 days'),
  (12,
   (SELECT id FROM public."USER" WHERE auth_user_id = '00000000-0000-4000-8000-000000000005'),
   'course.created', 'course', 2, NULL, (CURRENT_DATE - 44) + time '09:00:00')
ON CONFLICT (id) DO NOTHING;

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
SELECT setval(pg_get_serial_sequence('public."EVENT"', 'id'), 8, true);
SELECT setval(pg_get_serial_sequence('public."COURSE"', 'id'), 3, true);
SELECT setval(pg_get_serial_sequence('public."MODULE"', 'id'), 9, true);
SELECT setval(pg_get_serial_sequence('public."LESSON"', 'id'), 26, true);
SELECT setval(pg_get_serial_sequence('public."SPEAKER_PROFILE"', 'id'), 3, true);
SELECT setval(pg_get_serial_sequence('public."COMMUNITY_LINK"', 'id'), 2, true);
SELECT setval(pg_get_serial_sequence('public."PAYMENT"', 'id'), 35, true);
SELECT setval(pg_get_serial_sequence('public."TICKET"', 'id'), 28, true);
SELECT setval(pg_get_serial_sequence('public."SURVEY"', 'id'), 3, true);
SELECT setval(pg_get_serial_sequence('public."SURVEY_RESPONSE"', 'id'), 6, true);
SELECT setval(pg_get_serial_sequence('public."QA_MESSAGE"', 'id'), 10, true);
SELECT setval(pg_get_serial_sequence('public."CHAT_MESSAGE"', 'id'), 9, true);
SELECT setval(pg_get_serial_sequence('public."SUPPORT_SESSION"', 'id'), 4, true);
SELECT setval(pg_get_serial_sequence('public."STAFF_INVITE"', 'id'), 3, true);
SELECT setval(pg_get_serial_sequence('public."EMAIL_LOG"', 'id'), 9, true);
SELECT setval(pg_get_serial_sequence('public."AUDIT_LOG"', 'id'), 12, true);
SELECT setval('public.support_case_seq', 1004, true);
