-- Whether an event happens at a place or on a platform.
--
-- Until now the only thing that said "online" was prose inside venue_name, so
-- nothing could branch on it: the map card, the hero's venue fact and the
-- calendar LOCATION all read venue text and had no way to tell a hall from a
-- meeting link. This makes it a fact the code can act on.
--
-- Every existing row becomes 'onsite'. That is the honest default rather than a
-- guess — an event written before this column was described by a venue, and
-- nothing in the stored data distinguishes the ones that were actually online.
--
-- venue_name stays NOT NULL and simply widens its meaning to "where it happens":
-- a hall when onsite, a platform when online. Making it nullable would have
-- weakened a constraint a dozen readers depend on to buy nothing they need.

CREATE TYPE "public"."event_mode" AS ENUM (
    'onsite',
    'online'
);


ALTER TYPE "public"."event_mode" OWNER TO "postgres";


ALTER TABLE "public"."EVENT"
    ADD COLUMN IF NOT EXISTS "event_type" "public"."event_mode" DEFAULT 'onsite'::"public"."event_mode" NOT NULL;

-- A disabled input still holds the value it had before it was disabled. Without
-- this, flipping an event to online and saving would leave a stale street
-- address on the row, and the ticket, the map and the calendar invite would all
-- go on quoting it. The form clears the field and the API refuses the pair, but
-- neither of those is where the rule can be made true.
ALTER TABLE "public"."EVENT"
    ADD CONSTRAINT "chk_event_online_has_no_address" CHECK ((("event_type" <> 'online'::"public"."event_mode") OR ("venue_address" IS NULL)));
