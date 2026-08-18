-- Capacity on an event, and the gate that makes it mean something.
--
-- NULL is "uncapped", which is what every existing row becomes: the column is
-- added without a default, so nothing already scheduled changes behaviour.
--
-- A seat is what the app already counts as an attendee — a TICKET row that is
-- not cancelled — so a cancellation returns the seat to the pool without any
-- second counter to keep in step.
--
-- The route refuses a sold-out event before taking money, but a route cannot be
-- the last word: two buyers checking out at once both read "one seat left" and
-- both get a ticket. The trigger below is where the rule is actually true. It
-- locks the EVENT row first, so concurrent inserts for the same event queue
-- behind each other and the second one counts the first.

ALTER TABLE "public"."EVENT" ADD COLUMN IF NOT EXISTS "capacity" integer;

ALTER TABLE "public"."EVENT"
    ADD CONSTRAINT "chk_event_capacity_positive" CHECK (("capacity" IS NULL OR "capacity" > 0));

-- The seat count filters TICKET by event_id alone. idx_ticket_user_event leads
-- with user_id, so it cannot serve that; without this index every capacity
-- check — and the attendee counts the staff table has always run — is a scan.
CREATE INDEX IF NOT EXISTS "idx_ticket_event" ON "public"."TICKET" USING "btree" ("event_id");

CREATE OR REPLACE FUNCTION "public"."enforce_event_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  event_capacity integer;
  seats_taken integer;
BEGIN
  -- FOR UPDATE is the whole point: without it both halves of a race read the
  -- same pre-insert total and the event oversells by one.
  SELECT capacity INTO event_capacity FROM "EVENT" WHERE id = NEW.event_id FOR UPDATE;

  IF event_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO seats_taken FROM "TICKET" WHERE event_id = NEW.event_id AND status <> 'cancelled';

  IF seats_taken >= event_capacity THEN
    RAISE EXCEPTION 'Event % is at capacity (% of % seats taken)', NEW.event_id, seats_taken, event_capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_event_capacity"() OWNER TO "postgres";

-- INSERT only. No status transition revives a cancelled ticket — check-in and
-- cancellation are the only writes — so an UPDATE cannot claim a seat.
CREATE OR REPLACE TRIGGER "trg_enforce_event_capacity" BEFORE INSERT ON "public"."TICKET"
    FOR EACH ROW EXECUTE FUNCTION "public"."enforce_event_capacity"();
