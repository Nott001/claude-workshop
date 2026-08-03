-- ============================================================
-- Fix always-true RLS policies
--
-- Inside a correlated subquery an unqualified column name binds to the *inner*
-- table whenever that table has a column of the same name. Every policy below
-- compared `ef.event_id = event_id` (and friends), which Postgres read as
-- `ef.event_id = ef.event_id` — a tautology. The intended correlation to the
-- outer row never happened, so each of these gates was open.
--
-- 00006 and 00007 are left as shipped, per the standing rule against editing an
-- applied migration. They still create the buggy policies on a fresh replay;
-- every one is dropped and recreated here, so the end state is correct either
-- way — on a replay and on a database that already ran them.
-- ============================================================

-- ------------------------------------------------------------
-- QA_MESSAGE — the worst instance. The TICKET branch collapsed to "does this
-- user hold a ticket to anything", so any attendee with a single ticket could
-- read every Q&A message for every event.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users read Q&A messages for their events" ON "QA_MESSAGE";
DROP POLICY IF EXISTS "Users read Q&A messages for their modules" ON "QA_MESSAGE";

CREATE POLICY "Users read Q&A messages for their modules"
ON "QA_MESSAGE" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = "QA_MESSAGE".user_id
      OR
      EXISTS (
        SELECT 1 FROM "EVENT_FACILITATOR" ef
        WHERE ef.event_id = "QA_MESSAGE".event_id AND ef.user_id = u.id
      )
      OR
      EXISTS (
        SELECT 1 FROM "SPEAKER_PROFILE" sp
        JOIN "EVENT_SPEAKER" es ON es.speaker_profile_id = sp.id
        WHERE es.event_id = "QA_MESSAGE".event_id AND sp.user_id = u.id
      )
      OR
      EXISTS (
        SELECT 1 FROM "TICKET" t
        WHERE t.event_id = "QA_MESSAGE".event_id AND t.user_id = u.id
      )
    )
  )
);

-- ------------------------------------------------------------
-- CHAT_MESSAGE — the 'event' branch let any facilitator of any one event read
-- every event's support messages, including 1:1 DMs.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users read support messages" ON "CHAT_MESSAGE";

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
      OR
      ("CHAT_MESSAGE".support_type = 'event' AND EXISTS (
        SELECT 1 FROM "EVENT_FACILITATOR" ef
        WHERE ef.event_id = "CHAT_MESSAGE".event_id AND ef.user_id = u.id
      ))
    )
  )
);

-- ------------------------------------------------------------
-- SUPPORT_SESSION — not exploitable as written (USER has no `support_type` or
-- `user_id` column, so the names did bind outward), but qualified here so the
-- policy cannot silently invert the day a column is added to USER.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users see own support sessions" ON "SUPPORT_SESSION";

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
      OR
      ("SUPPORT_SESSION".support_type = 'event' AND u.role IN ('facilitator', 'admin', 'super_admin'))
    )
  )
);

-- ============================================================
-- Draft events were visible to every authenticated user
--
-- "Published events are public" (status IN active/complete) was OR'd with
-- "Events visible to authenticated" USING (true). Policies on the same command
-- combine with OR, so the second one made the first decorative and exposed
-- every draft to anyone logged in.
-- ============================================================
DROP POLICY IF EXISTS "Events visible to authenticated" ON "EVENT";

CREATE POLICY "Staff see unpublished events"
ON "EVENT" FOR SELECT
TO authenticated
USING (
  status IN ('active', 'complete')
  OR EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('facilitator', 'admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM "USER" u
    JOIN "EVENT_FACILITATOR" ef ON ef.user_id = u.id
    WHERE u.auth_user_id = auth.uid() AND ef.event_id = "EVENT".id
  )
);

-- ============================================================
-- GRANT ALL ON SCHEMA public included CREATE
--
-- 00001 granted ALL on the schema to anon and authenticated, which carries
-- CREATE — any visitor could add objects to the public schema. USAGE is what
-- these roles actually need; table-level grants are unaffected, and migrations
-- run as the owner.
-- ============================================================
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;
