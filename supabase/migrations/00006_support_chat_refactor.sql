-- ============================================================
-- Refactor support chat: split into general/event, separate Q&A
-- ============================================================

-- New support_type enum
CREATE TYPE support_type AS ENUM ('general', 'event');

-- ============================================================
-- SUPPORT_SESSION changes
-- ============================================================
ALTER TABLE "SUPPORT_SESSION"
  ADD COLUMN support_type support_type NOT NULL DEFAULT 'general',
  ADD COLUMN event_id INT REFERENCES "EVENT"(id) ON DELETE CASCADE;

-- Drop old unique index and create new one scoped to (user, support_type, event)
DROP INDEX IF EXISTS idx_support_session_active_user;
CREATE UNIQUE INDEX idx_support_session_active
  ON "SUPPORT_SESSION"(user_id, support_type, COALESCE(event_id, 0))
  WHERE status = 'active';

-- ============================================================
-- CHAT_MESSAGE changes — now only for support messages
-- ============================================================
ALTER TABLE "CHAT_MESSAGE"
  ALTER COLUMN event_id DROP NOT NULL,
  ADD COLUMN support_type support_type NOT NULL DEFAULT 'general',
  DROP COLUMN channel,
  DROP COLUMN reply_to,
  DROP COLUMN answered_verbally;

DROP INDEX IF EXISTS idx_chat_message_event_channel;
CREATE INDEX idx_chat_message_support
  ON "CHAT_MESSAGE"(support_type, event_id, sent_at DESC);

-- ============================================================
-- QA_MESSAGE — new table, separated from support chat
-- ============================================================
CREATE TABLE "QA_MESSAGE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES "USER"(id),
  message TEXT NOT NULL,
  reply_to INT REFERENCES "QA_MESSAGE"(id) ON DELETE SET NULL,
  answered_verbally BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_message_event ON "QA_MESSAGE"(event_id, created_at DESC);

-- Drop the old chat_channel enum
DROP TYPE IF EXISTS chat_channel;

-- ============================================================
-- Grants
-- ============================================================
GRANT ALL ON "QA_MESSAGE" TO service_role;
GRANT SELECT ON "QA_MESSAGE" TO authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE "QA_MESSAGE" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read Q&A messages for their events"
ON "QA_MESSAGE" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = user_id
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
      OR
      EXISTS (
        SELECT 1 FROM "TICKET" t
        WHERE t.event_id = event_id AND t.user_id = u.id
      )
    )
  )
);

-- Update CHAT_MESSAGE policy to use support_type
DROP POLICY IF EXISTS "Users read their channel messages" ON "CHAT_MESSAGE";
CREATE POLICY "Users read support messages"
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
      (support_type = 'general' AND u.role IN ('admin', 'super_admin'))
      OR
      (support_type = 'event' AND EXISTS (
        SELECT 1 FROM "EVENT_FACILITATOR" ef
        WHERE ef.event_id = event_id AND ef.user_id = u.id
      ))
    )
  )
);

-- Update SUPPORT_SESSION policy
DROP POLICY IF EXISTS "Users see own support sessions" ON "SUPPORT_SESSION";
CREATE POLICY "Users see own support sessions"
ON "SUPPORT_SESSION" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = user_id
      OR
      (support_type = 'general' AND u.role IN ('admin', 'super_admin'))
      OR
      (support_type = 'event' AND u.role IN ('facilitator', 'admin', 'super_admin'))
    )
  )
);

-- ============================================================
-- Realtime publications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE "QA_MESSAGE";
