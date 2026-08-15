-- The QA_MESSAGE SELECT policy subqueries TICKET, but the browser-facing
-- "authenticated" role has no SELECT grant and no SELECT policy on TICKET, so
-- evaluating the policy under that role raised 42501. Supabase Realtime runs
-- the read policy for every emitted row, so one 42501 killed delivery for
-- every subscriber: a new question appeared for nobody, sender or staff, until
-- a refresh. REST survived because the app lists messages server-side with the
-- service_role client (BYPASSRLS).
--
-- Route the check through a SECURITY DEFINER helper, the same seam
-- conversation_participant already is: the function runs as its owner, so it
-- may read TICKET and the team tables without widening any grant. The body
-- keeps the four original branches -- asker, assigned facilitator, assigned
-- speaker, ticket holder -- verbatim from 00001. Every statement is
-- idempotent or guarded, so a replay settles on this final state.

CREATE OR REPLACE FUNCTION "public"."qa_message_visible"(message_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM "QA_MESSAGE" qa
    JOIN "USER" me ON me.auth_user_id = auth.uid()
    WHERE qa.id = qa_message_visible.message_id
      AND (
        me.id = qa.user_id
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
  );
$function$;

ALTER FUNCTION "public"."qa_message_visible"(integer) OWNER TO "postgres";

-- Replace the inline-subquery policy. 00001 and 00003 created the policy with
-- the TICKET subquery inline; 00004 swaps it for the helper so a replay of
-- 00001 -> 00004 settles on the same final shape as a drifted environment.
DROP POLICY IF EXISTS "Users read Q&A messages for their modules" ON "public"."QA_MESSAGE";

CREATE POLICY "Users read Q&A messages for their modules"
  ON "public"."QA_MESSAGE"
  FOR SELECT TO "authenticated"
  USING ("public"."qa_message_visible"("id"));