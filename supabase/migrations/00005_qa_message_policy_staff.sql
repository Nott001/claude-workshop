-- qa_message_visible admits the asker, the event team and ticket holders, but
-- the room lets staff in too: canAccessCourseRoom clears anyone with
-- hasMinRole(role, FACILITATOR) regardless of assignment. A facilitator or
-- admin moderating a room they are not on the event's team for therefore
-- reads questions fine through REST (service_role) yet Realtime dropped the
-- row -- the helper returned false under their claims, so an INSERT reached
-- nobody on that side and every staff viewer kept needing a refresh.
--
-- Mirror the staff arm of the room gate here so realtime delivery matches
-- what the room shows. Unassigned speakers stay excluded, exactly like
-- canAccessCourseRoom turns them away at the door; the assigned-speaker
-- branch below already covers the ones the room admits.

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
        OR me.role IN ('facilitator', 'admin', 'super_admin')
      )
  );
$function$;

ALTER FUNCTION "public"."qa_message_visible"(integer) OWNER TO "postgres";
