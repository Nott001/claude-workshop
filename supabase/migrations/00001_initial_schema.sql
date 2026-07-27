-- ============================================================
-- Fresh start: drop everything and rebuild
-- ============================================================
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE user_role AS ENUM ('attendee', 'speaker', 'facilitator');

CREATE TYPE content_type AS ENUM ('pdf', 'video', 'image', 'link');

CREATE TYPE event_status AS ENUM ('draft', 'active', 'complete');

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TYPE ticket_status AS ENUM ('issued', 'checked_in', 'cancelled');

CREATE TYPE chat_channel AS ENUM ('support', 'live_qa');

CREATE TYPE support_session_status AS ENUM ('active', 'ended_by_facilitator');

CREATE TYPE email_type AS ENUM ('ticket_issued', 'check_in_confirmed');

CREATE TYPE email_status AS ENUM ('sent', 'failed');

CREATE TYPE audit_action AS ENUM (
  'event.created', 'event.updated', 'event.deleted', 'event.published',
  'speaker.assigned', 'speaker.unassigned',
  'organization.invited', 'organization.role_changed', 'organization.removed',
  'checkin.performed',
  'course.created', 'course.updated', 'course.deleted',
  'module.created', 'module.updated', 'module.deleted',
  'lesson.created', 'lesson.updated', 'lesson.deleted'
);

CREATE TYPE survey_question_type AS ENUM ('text', 'multiple_choice', 'checkbox', 'rating', 'scale');

CREATE TYPE staff_invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- ============================================================
-- Tables (ordered to satisfy FK dependencies)
-- ============================================================

-- 1. USER — no FKs
CREATE TABLE "USER" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  auth_user_id UUID NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'attendee',
  profile_image_url VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_role ON "USER"(role);

-- 2. COURSE — no FKs
CREATE TABLE "COURSE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_name VARCHAR NOT NULL,
  course_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SYSTEM_SETTING — FK to USER
CREATE TABLE "SYSTEM_SETTING" (
  setting_key VARCHAR PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by INT REFERENCES "USER"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. SPEAKER_PROFILE — FK to USER
CREATE TABLE "SPEAKER_PROFILE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES "USER"(id) ON DELETE CASCADE,
  bio TEXT,
  designation VARCHAR,
  linkedin_url VARCHAR,
  twitter_url VARCHAR,
  github_url VARCHAR,
  website_url VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. MODULE — FK to COURSE
CREATE TABLE "MODULE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INT NOT NULL REFERENCES "COURSE"(id) ON DELETE CASCADE,
  module_name VARCHAR NOT NULL,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_course_sequence ON "MODULE"(course_id, sequence_order);

-- 6. LESSON — FK to MODULE
CREATE TABLE "LESSON" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_id INT NOT NULL REFERENCES "MODULE"(id) ON DELETE CASCADE,
  description VARCHAR NOT NULL,
  content_type content_type NOT NULL,
  content_url VARCHAR,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_module_sequence ON "LESSON"(module_id, sequence_order);

-- 7. EVENT — FK to COURSE
CREATE TABLE "EVENT" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INT REFERENCES "COURSE"(id) ON DELETE SET NULL,
  title VARCHAR NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_address TEXT,
  venue_name VARCHAR NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  cover_image_url VARCHAR,
  status event_status NOT NULL DEFAULT 'draft',
  facilitator_surveys_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_time CHECK (start_time < end_time),
  CONSTRAINT chk_event_price_nonneg CHECK (price >= 0)
);

CREATE INDEX idx_event_date ON "EVENT"(event_date);
CREATE INDEX idx_event_status ON "EVENT"(status);

-- 8. EVENT_FACILITATOR — FKs to EVENT, USER
CREATE TABLE "EVENT_FACILITATOR" (
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES "USER"(id) ON DELETE CASCADE,
  assigned_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- 9. EVENT_SPEAKER — FKs to EVENT, SPEAKER_PROFILE
CREATE TABLE "EVENT_SPEAKER" (
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  speaker_profile_id INT NOT NULL REFERENCES "SPEAKER_PROFILE"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, speaker_profile_id)
);

CREATE INDEX idx_event_speaker_profile ON "EVENT_SPEAKER"(speaker_profile_id);

-- 10. LIVE_SESSION_STATE — FKs to EVENT, LESSON, USER
CREATE TABLE "LIVE_SESSION_STATE" (
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  highlighted_lesson_id INT REFERENCES "LESSON"(id) ON DELETE SET NULL,
  updated_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id)
);

-- 11. PAYMENT — FKs to USER, EVENT
CREATE TABLE "PAYMENT" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USER"(id),
  event_id INT NOT NULL REFERENCES "EVENT"(id),
  gateway_reference_id VARCHAR UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_amount_nonneg CHECK (amount >= 0)
);

CREATE INDEX idx_payment_user_event ON "PAYMENT"(user_id, event_id);
CREATE INDEX idx_payment_status ON "PAYMENT"(status);

-- 12. TICKET — FKs to PAYMENT, USER, EVENT
CREATE TABLE "TICKET" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id INT REFERENCES "PAYMENT"(id) ON DELETE SET NULL,
  user_id INT NOT NULL REFERENCES "USER"(id),
  event_id INT NOT NULL REFERENCES "EVENT"(id),
  qr_token VARCHAR NOT NULL UNIQUE,
  status ticket_status NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_user_event ON "TICKET"(user_id, event_id);
CREATE INDEX idx_ticket_qr ON "TICKET"(qr_token);

-- 13. STAFF_INVITE — FKs to EVENT, USER
CREATE TABLE "STAFF_INVITE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR NOT NULL,
  full_name VARCHAR NOT NULL,
  invited_role user_role NOT NULL,
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  invited_by INT NOT NULL REFERENCES "USER"(id),
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  status staff_invite_status NOT NULL DEFAULT 'pending',
  external_id VARCHAR,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. COMMUNITY_LINK — FKs to EVENT, USER
CREATE TABLE "COMMUNITY_LINK" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  platform VARCHAR NOT NULL,
  label VARCHAR NOT NULL,
  url VARCHAR NOT NULL,
  icon_url VARCHAR,
  sequence_order INT NOT NULL,
  created_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. SUPPORT_SESSION — FK to USER
CREATE TABLE "SUPPORT_SESSION" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USER"(id) ON DELETE CASCADE,
  status support_session_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_support_session_active_user ON "SUPPORT_SESSION"(user_id) WHERE status = 'active';
CREATE INDEX idx_support_session_user_created ON "SUPPORT_SESSION"(user_id, created_at DESC);

-- 16. CHAT_MESSAGE — FKs to EVENT, USER, SUPPORT_SESSION
CREATE TABLE "CHAT_MESSAGE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  channel chat_channel NOT NULL,
  user_id INT NOT NULL REFERENCES "USER"(id),
  recipient_user_id INT REFERENCES "USER"(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by INT[] NOT NULL DEFAULT '{}',
  reply_to INT REFERENCES "CHAT_MESSAGE"(id) ON DELETE SET NULL,
  answered_verbally BOOLEAN NOT NULL DEFAULT false,
  session_id INT REFERENCES "SUPPORT_SESSION"(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_message_event_channel ON "CHAT_MESSAGE"(event_id, channel, sent_at DESC);
CREATE INDEX idx_chat_message_recipient ON "CHAT_MESSAGE"(recipient_user_id);

-- 17. SURVEY — FKs to EVENT, COURSE, USER
CREATE TABLE "SURVEY" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT REFERENCES "EVENT"(id) ON DELETE CASCADE,
  course_id INT REFERENCES "COURSE"(id) ON DELETE CASCADE,
  created_by INT REFERENCES "USER"(id) ON DELETE SET NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. SURVEY_QUESTION — FK to SURVEY
CREATE TABLE "SURVEY_QUESTION" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id INT NOT NULL REFERENCES "SURVEY"(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type survey_question_type NOT NULL,
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. SURVEY_RESPONSE — FKs to SURVEY, USER
CREATE TABLE "SURVEY_RESPONSE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id INT NOT NULL REFERENCES "SURVEY"(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES "USER"(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. SURVEY_ANSWER — FKs to SURVEY_RESPONSE, SURVEY_QUESTION
CREATE TABLE "SURVEY_ANSWER" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id INT NOT NULL REFERENCES "SURVEY_RESPONSE"(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES "SURVEY_QUESTION"(id) ON DELETE CASCADE,
  answer_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. EMAIL_LOG — FK to USER
CREATE TABLE "EMAIL_LOG" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USER"(id),
  email_type email_type NOT NULL,
  status email_status NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_user ON "EMAIL_LOG"(user_id);
CREATE INDEX idx_email_log_type ON "EMAIL_LOG"(email_type);
CREATE INDEX idx_email_log_status ON "EMAIL_LOG"(status);
CREATE INDEX idx_email_log_sent_at ON "EMAIL_LOG"(sent_at);

-- 22. AUDIT_LOG — FK to USER
CREATE TABLE "AUDIT_LOG" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id INT NOT NULL REFERENCES "USER"(id),
  action audit_action NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id INT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON "AUDIT_LOG"(actor_id);
CREATE INDEX idx_audit_log_entity ON "AUDIT_LOG"(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON "AUDIT_LOG"(created_at DESC);

-- ============================================================
-- Table-level grants
-- ============================================================

-- service_role gets full access on all tables (existing API routes use this)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Public read-only access on published/speaker data for anon
GRANT SELECT ON "EVENT" TO anon;
GRANT SELECT ON "SPEAKER_PROFILE" TO anon;
GRANT SELECT ON "COMMUNITY_LINK" TO anon;
GRANT SELECT ON "LIVE_SESSION_STATE" TO anon;

-- Authenticated users can read domain tables (writes go through API)
GRANT SELECT ON "COURSE" TO authenticated;
GRANT SELECT ON "MODULE" TO authenticated;
GRANT SELECT ON "LESSON" TO authenticated;
GRANT SELECT ON "EVENT" TO authenticated;
GRANT SELECT ON "EVENT_FACILITATOR" TO authenticated;
GRANT SELECT ON "EVENT_SPEAKER" TO authenticated;
GRANT SELECT ON "SPEAKER_PROFILE" TO authenticated;
GRANT SELECT ON "COMMUNITY_LINK" TO authenticated;
GRANT SELECT ON "SUPPORT_SESSION" TO authenticated;
GRANT SELECT ON "CHAT_MESSAGE" TO authenticated;
GRANT SELECT ON "LIVE_SESSION_STATE" TO authenticated;

-- No direct table grants (API-only access): USER, PAYMENT, TICKET,
-- STAFF_INVITE, SURVEY, SURVEY_QUESTION, SURVEY_RESPONSE, SURVEY_ANSWER,
-- EMAIL_LOG, AUDIT_LOG, SYSTEM_SETTING

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE "USER" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "COURSE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SYSTEM_SETTING" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SPEAKER_PROFILE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MODULE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LESSON" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EVENT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EVENT_FACILITATOR" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EVENT_SPEAKER" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LIVE_SESSION_STATE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PAYMENT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TICKET" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "STAFF_INVITE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "COMMUNITY_LINK" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SUPPORT_SESSION" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CHAT_MESSAGE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SURVEY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SURVEY_QUESTION" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SURVEY_RESPONSE" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SURVEY_ANSWER" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EMAIL_LOG" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AUDIT_LOG" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Published/complete events visible to everyone
CREATE POLICY "Published events are public"
ON "EVENT" FOR SELECT
TO anon, authenticated
USING (status IN ('active', 'complete'));

-- Speaker profiles are public
CREATE POLICY "Speaker profiles are public"
ON "SPEAKER_PROFILE" FOR SELECT
TO anon, authenticated
USING (true);

-- Community links are public
CREATE POLICY "Community links are public"
ON "COMMUNITY_LINK" FOR SELECT
TO anon, authenticated
USING (true);

-- Live session state visible to all (realtime)
CREATE POLICY "Live state visible to all"
ON "LIVE_SESSION_STATE" FOR SELECT
TO anon, authenticated
USING (true);

-- Courses and content visible to authenticated users
CREATE POLICY "Courses visible to authenticated"
ON "COURSE" FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Modules visible to authenticated"
ON "MODULE" FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Lessons visible to authenticated"
ON "LESSON" FOR SELECT
TO authenticated
USING (true);

-- Events fully visible to authenticated
CREATE POLICY "Events visible to authenticated"
ON "EVENT" FOR SELECT
TO authenticated
USING (true);

-- assignments visible to authenticated
CREATE POLICY "Facilitator assignments visible"
ON "EVENT_FACILITATOR" FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Speaker assignments visible"
ON "EVENT_SPEAKER" FOR SELECT
TO authenticated
USING (true);

-- Users see their own support sessions; speakers/facilitators see all
CREATE POLICY "Users see own support sessions"
ON "SUPPORT_SESSION" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND u.id = user_id
  )
  OR
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND u.role IN ('facilitator', 'speaker')
  )
);

-- Users read messages they sent, received, or that belong to their events
CREATE POLICY "Users read their channel messages"
ON "CHAT_MESSAGE" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = user_id
      OR
      u.id = recipient_user_id
      OR
      EXISTS (
        SELECT 1 FROM "EVENT_FACILITATOR" ef
        WHERE ef.event_id = event_id AND ef.user_id = u.id
      )
      OR
      EXISTS (
        SELECT 1 FROM "SPEAKER_PROFILE" sp
        JOIN "EVENT_SPEAKER" es ON es.speaker_profile_id = sp.id
        WHERE es.event_id = event_id AND sp.user_id = u.id
      )
    )
  )
);

-- ============================================================
-- Realtime publications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE "LIVE_SESSION_STATE";
ALTER PUBLICATION supabase_realtime ADD TABLE "CHAT_MESSAGE";
ALTER PUBLICATION supabase_realtime ADD TABLE "SUPPORT_SESSION";
ALTER PUBLICATION supabase_realtime ADD TABLE "TICKET";
