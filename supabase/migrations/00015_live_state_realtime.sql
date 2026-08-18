-- Browsers drop their 5s highlight poll once LIVE_SESSION_STATE broadcasts over
-- realtime (see spec 05). The write path is unchanged -- live-session.dao.ts
-- upserts through the service client -- publishing this table only emits
-- postgres_changes for it, and the existing read grants (00001) gate delivery:
-- both anon and authenticated can see the row, so every room client qualifies.
--
-- Add LIVE_SESSION_STATE to the publication only if it is not already a member.
-- The ADD TABLE is a literal inside EXECUTE (not format('%I')) so the migration
-- tests can extract the membership statement; the guard keeps a re-run from
-- duplicating membership.
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
      AND c.relname = 'LIVE_SESSION_STATE'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "public"."LIVE_SESSION_STATE";';
  END IF;
END;
$$;