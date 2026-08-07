-- Realtime callbacks enrich an inserted CHAT_MESSAGE with "*, USER:user_id(full_name, role)"
-- through the browser client. USER has RLS on and no grants, so that embed fails with 42501
-- and the new message is dropped until the page reloads. Grant the public columns to
-- authenticated and let rows through for users the caller could already reach through a
-- CHAT_MESSAGE or QA_MESSAGE they can read, so names resolve in realtime without exposing
-- email.
--
-- auth_user_id is in the grant because it is not cosmetic: the existing CHAT_MESSAGE,
-- QA_MESSAGE and SUPPORT_SESSION policies (00008) resolve the caller with
-- `u.auth_user_id = auth.uid()`, and Realtime evaluates those policies before it will
-- deliver an event. Without SELECT on that one column every event is silently dropped.
--
-- The membership check must live in a SECURITY DEFINER function. The existing
-- CHAT_MESSAGE/QA_MESSAGE policies already reference USER, so a USER policy that references
-- them back is infinite recursion in row security. The function runs as the table owner,
-- bypassing RLS, and mirrors the read rules from 00008 by hand.

DROP POLICY IF EXISTS "Users read conversation participants" ON "USER";

GRANT SELECT (id, auth_user_id, full_name, role) ON "USER" TO authenticated;

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
          OR (m.support_type = 'event' AND EXISTS (
            SELECT 1 FROM "EVENT_FACILITATOR" ef
            WHERE ef.event_id = m.event_id AND ef.user_id = me.id
          ))
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

CREATE POLICY "Users read conversation participants"
ON "USER" FOR SELECT TO authenticated
USING (public.conversation_participant(id));
