-- Where an online event actually happens.
--
-- Nullable, and nullable on purpose rather than by omission: the room usually
-- does not exist yet when the event is scheduled. Somebody creates the event in
-- March, and the Meet link is made the morning of. A NOT NULL here would force
-- a placeholder to be invented at creation, and a placeholder link is worse than
-- no link — it is indistinguishable from a real one to the person clicking it.
--
-- Only an online event can carry one. An address and a meeting link are the two
-- halves of the same question, and 00010 already refuses an address on an online
-- event; this is the mirror. Without it, turning an event back to onsite would
-- leave a live meeting link on a row nothing renders it from, which is exactly
-- the kind of orphan that resurfaces the day someone widens a query.
--
-- No index: the column is read by primary key with the rest of the row, and
-- nothing filters or sorts on it.

ALTER TABLE "public"."EVENT" ADD COLUMN IF NOT EXISTS "meeting_url" character varying(2048);

ALTER TABLE "public"."EVENT"
    ADD CONSTRAINT "chk_event_meeting_url_online_only" CHECK ((("event_type" = 'online'::"public"."event_mode") OR ("meeting_url" IS NULL)));
