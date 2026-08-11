-- ============================================================
-- Remove event support chat
--
-- Support is general-only now: admins handle it outside event
-- rooms. The event-scoped branch (support_type = 'event' plus the
-- CHAT_MESSAGE/SUPPORT_SESSION event_id columns) is dropped.
-- The rows die with the branch; the event_id columns and the
-- event-role policies/indexes that referenced them go next.
--
-- The rename/create/drop guards make this safe to re-run against a
-- database where an earlier attempt failed midway (the enum rename
-- and the new type both already landed there).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Purge event-support rows before the enum loses its value.
-- CHAT_MESSAGE first so its rows are gone before SUPPORT_SESSION
-- (whose session delete would otherwise cascade, and standalone
-- messages would be left dangling).
-- ------------------------------------------------------------
DELETE FROM "CHAT_MESSAGE" WHERE support_type = 'event';
DELETE FROM "SUPPORT_SESSION" WHERE support_type = 'event';

-- ------------------------------------------------------------
-- 2. Drop the event branches the policies/functions/columns feed.
-- Policies must go before the columns they reference.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users read support messages" ON "CHAT_MESSAGE";
DROP POLICY IF EXISTS "Users see own support sessions" ON "SUPPORT_SESSION";

-- conversation_participant() reads the chat event column; re-point it at the
-- general branch so dropping that column does not trip its dependency.
CREATE OR REPLACE FUNCTION public.conversation_participant(target_user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_user_id = me.id
    OR EXISTS (
      SELECT 1 FROM "CHAT_MESSAGE" m
      WHERE (m.user_id = target_user_id OR m.recipient_user_id = target_user_id)
        AND (
          m.user_id = me.id
          OR m.recipient_user_id = me.id
          OR (m.support_type = 'general' AND me.role IN ('admin', 'super_admin'))
        )
    )
    OR EXISTS (
      SELECT 1 FROM "QA_MESSAGE" qa
      WHERE qa.user_id = target_user_id
        AND (
          qa.user_id = me.id
          OR EXISTS (
            SELECT 1 FROM "EVENT_FACILITATOR" ef
            WHERE ef.event_id = qa.event_id AND ef.user_id = me.id
          )
          OR EXISTS (
            SELECT 1 FROM "SPEAKER_PROFILE" sp
            JOIN "EVENT_SPEAKER" es ON es.speaker_profile_id = sp.id
            WHERE es.event_id = qa.event_id AND sp.user_id = me.id
          )
          OR EXISTS (
            SELECT 1 FROM "TICKET" t
            WHERE t.event_id = qa.event_id AND t.user_id = me.id
          )
        )
    )
  FROM "USER" me
  WHERE me.auth_user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- 3. Drop the event_id columns and the indexes that indexed them.
-- IF EXISTS resumes a run that already dropped them.
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_chat_message_support;
DROP INDEX IF EXISTS idx_support_session_active;

ALTER TABLE "CHAT_MESSAGE" DROP COLUMN IF EXISTS event_id;
ALTER TABLE "SUPPORT_SESSION" DROP COLUMN IF EXISTS event_id;

-- ------------------------------------------------------------
-- 4. Narrow the enum to the one remaining value.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'support_type_legacy' AND n.nspname = 'public') THEN
    ALTER TYPE support_type RENAME TO support_type_legacy;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'support_type' AND t.typtype = 'e' AND n.nspname = 'public') THEN
    CREATE TYPE support_type AS ENUM ('general');
  END IF;
END
$$;

-- The column defaults reference the old type, so they have to go
-- before the cast and come back after it.
ALTER TABLE "CHAT_MESSAGE" ALTER COLUMN support_type DROP DEFAULT;
ALTER TABLE "SUPPORT_SESSION" ALTER COLUMN support_type DROP DEFAULT;

ALTER TABLE "CHAT_MESSAGE"
  ALTER COLUMN support_type TYPE support_type USING support_type::text::support_type;
ALTER TABLE "SUPPORT_SESSION"
  ALTER COLUMN support_type TYPE support_type USING support_type::text::support_type;

ALTER TABLE "CHAT_MESSAGE" ALTER COLUMN support_type SET DEFAULT 'general';
ALTER TABLE "SUPPORT_SESSION" ALTER COLUMN support_type SET DEFAULT 'general';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'support_type_legacy' AND n.nspname = 'public') THEN
    DROP TYPE support_type_legacy;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 5. Recreate the active-session uniqueness without event scope,
-- and the policies without the event branches.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX idx_support_session_active
  ON "SUPPORT_SESSION"(user_id, support_type)
  WHERE status = 'active';

CREATE POLICY "Users read support messages"
ON "CHAT_MESSAGE" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = "CHAT_MESSAGE".user_id
      OR
      u.id = "CHAT_MESSAGE".recipient_user_id
      OR
      ("CHAT_MESSAGE".support_type = 'general' AND u.role IN ('admin', 'super_admin'))
    )
  )
);

CREATE POLICY "Users see own support sessions"
ON "SUPPORT_SESSION" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = "SUPPORT_SESSION".user_id
      OR
      ("SUPPORT_SESSION".support_type = 'general' AND u.role IN ('admin', 'super_admin'))
    )
  )
);
