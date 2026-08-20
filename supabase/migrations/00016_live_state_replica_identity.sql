-- Realtime UPDATEs on LIVE_SESSION_STATE decode only the primary key
-- (course_id) under the default replica identity, so the delivered payload
-- never carries highlighted_lesson_id and every room viewer clears it until a
-- refresh re-seeds the value. 00015 added the table to the publication but not
-- its identity; this mirrors 00013's fix for the message tables.
ALTER TABLE "public"."LIVE_SESSION_STATE" REPLICA IDENTITY FULL;