-- Issue #266: the kiosk attendee table and the ticket pass subscribe to
-- TICKET via Supabase Realtime, which runs the caller's SELECT policy for
-- every emitted row. The browser role is `authenticated`, and 00001 granted
-- TICKET only to service_role -- so no policy matched, realtime dropped every
-- event, and both surfaces only updated on a manual refresh. This grants the
-- role a read scoped by ticket_visible(): admins/super_admins by role,
-- facilitators assigned to the ticket's event, or the ticket's own holder.
-- anon is not granted anything here and stays unable to read TICKET.

GRANT SELECT ON TABLE "public"."TICKET" TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."ticket_visible"(ticket_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM "TICKET" t
    JOIN "USER" me ON me.auth_user_id = auth.uid()
    WHERE t.id = ticket_visible.ticket_id
      AND (
        me.role IN ('admin', 'super_admin')
        OR EXISTS (
          SELECT 1 FROM "EVENT_FACILITATOR" ef
          WHERE ef.event_id = t.event_id AND ef.user_id = me.id
        )
        OR t.user_id = me.id
      )
  );
$function$;

ALTER FUNCTION "public"."ticket_visible"(integer) OWNER TO "postgres";

-- CREATE POLICY has no IF NOT EXISTS, so the pg_policies guard keeps this
-- replay-safe (same pattern as 00003).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_catalog"."pg_policies"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'TICKET'
      AND "policyname" = 'Staff and ticket holders read tickets'
  ) THEN
    EXECUTE $ticket_policy$
      CREATE POLICY "Staff and ticket holders read tickets" ON "public"."TICKET"
        FOR SELECT TO "authenticated"
        USING ("public"."ticket_visible"("id"));
    $ticket_policy$;
  END IF;
END;
$$;