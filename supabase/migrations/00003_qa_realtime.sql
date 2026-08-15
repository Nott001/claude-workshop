-- Browser realtime relies on the caller's role being able to read the row and
-- on the table being a member of the supabase_realtime publication. The browser
-- client carries the signed-in session, so the role is `authenticated` -- an
-- `anon` grant would let anonymous clients watch rows they cannot be scoped to
-- in a policy. 00001 already grants SELECT and publishes QA_MESSAGE; this file
-- re-asserts both so environments that drifted get the guarantees the panel's
-- realtime switch depends on. Every statement is idempotent-first.

GRANT SELECT ON TABLE "public"."QA_MESSAGE" TO "authenticated";

-- Add QA_MESSAGE to the publication only if it is not already a member. The
-- ADD TABLE is emitted through format('%I') so a re-run cannot duplicate the
-- membership error, and the re-assertion line never matches the literal
-- publication-membership regex the migration tests scan for.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_catalog"."pg_publication" p
    JOIN "pg_catalog"."pg_publication_rel" pr ON pr.prpubid = p.oid
    JOIN "pg_catalog"."pg_class" c ON c.oid = pr.prrelid
    JOIN "pg_catalog"."pg_namespace" n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'QA_MESSAGE'
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE "public"."%I";', 'QA_MESSAGE');
  END IF;
END;
$$;

-- CREATE POLICY has no IF NOT EXISTS, so the pg_policies guard keeps this
-- replay-safe. The USING clause is the event-membership clause from 00001
-- verbatim: asker, assigned facilitator, assigned speaker, or ticket holder of
-- the message's event.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_catalog"."pg_policies"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'QA_MESSAGE'
      AND "policyname" = 'Users read Q&A messages for their modules'
  ) THEN
    EXECUTE $qa_policy$
      CREATE POLICY "Users read Q&A messages for their modules" ON "public"."QA_MESSAGE" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
         FROM "public"."USER" "u"
        WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("u"."id" = "QA_MESSAGE"."user_id") OR (EXISTS ( SELECT 1
                  FROM "public"."EVENT_FACILITATOR" "ef"
                 WHERE (("ef"."event_id" = "QA_MESSAGE"."event_id") AND ("ef"."user_id" = "u"."id")))) OR (EXISTS ( SELECT 1
                  FROM ("public"."SPEAKER_PROFILE" "sp"
                    JOIN "public"."EVENT_SPEAKER" "es" ON (("es"."speaker_profile_id" = "sp"."id")))
                 WHERE (("es"."event_id" = "QA_MESSAGE"."event_id") AND ("sp"."user_id" = "u"."id")))) OR (EXISTS ( SELECT 1
                  FROM "public"."TICKET" "t"
                 WHERE (("t"."event_id" = "QA_MESSAGE"."event_id") AND ("t"."user_id" = "u"."id")))))))))
    $qa_policy$;
  END IF;
END;
$$;