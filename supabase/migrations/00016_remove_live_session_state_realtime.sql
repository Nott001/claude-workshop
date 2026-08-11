-- ============================================================
-- LIVE_SESSION_STATE is no longer a realtime table
--
-- The course-room highlight is SWR-polled through live-session.dao and the
-- service; nothing subscribes to the table, so its supabase_realtime entry
-- from 00001 only makes the publication do extra work. Drop the entry; the
-- table and its RLS stay.
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE "LIVE_SESSION_STATE";
