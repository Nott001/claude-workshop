-- LIVE_SESSION_STATE is course-presentation state, not event state: re-key to COURSE.
-- COURSE.event_id is NOT NULL UNIQUE (00004), so every row resolves to a course.
-- Grants, the "Live state visible to all" RLS policy and the realtime publication
-- are table-level and need no change.

ALTER TABLE "LIVE_SESSION_STATE" ADD COLUMN course_id INT;

UPDATE "LIVE_SESSION_STATE" s
SET course_id = c.id
FROM "COURSE" c
WHERE c.event_id = s.event_id;

ALTER TABLE "LIVE_SESSION_STATE" ALTER COLUMN course_id SET NOT NULL;

ALTER TABLE "LIVE_SESSION_STATE" DROP CONSTRAINT "LIVE_SESSION_STATE_pkey";
ALTER TABLE "LIVE_SESSION_STATE" ADD PRIMARY KEY (course_id);

ALTER TABLE "LIVE_SESSION_STATE"
  ADD CONSTRAINT "LIVE_SESSION_STATE_course_id_fkey"
  FOREIGN KEY (course_id) REFERENCES "COURSE"(id) ON DELETE CASCADE;

ALTER TABLE "LIVE_SESSION_STATE" DROP COLUMN event_id;
