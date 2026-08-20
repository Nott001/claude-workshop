-- Photos taken at an event, so a finished one has an archive behind it.
--
-- The memories strip on /community has only ever been able to restate the
-- event's own detail page, because an event holds exactly one cover image and
-- nothing behind it. A cover is chosen before the event to sell it; these are
-- taken during it, there are many, and they outlive the session — so they are
-- their own rows rather than more columns on EVENT.
--
-- The objects live in the existing `event_images` bucket under
-- `events/{id}/photos/`, which the storage route already reads as "belongs to
-- event {id}" and serves publicly once that event is published. This table
-- carries what the bucket cannot: order, caption, and who uploaded it.

-- The trail covers who added and removed each photo. `audit_action` is a real
-- enum, so the two new actions have to exist before a route can write one.
-- Safe inside the migration's transaction on PG 12+ because nothing here reads
-- the values back; the first row using them is written by a request, later.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event.photo_added';
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'event.photo_removed';


CREATE TABLE IF NOT EXISTS "public"."EVENT_PHOTO" (
    "id" integer NOT NULL,
    "event_id" integer NOT NULL,
    -- The object key, not the served URL. `/api/storage/...` is how this
    -- deployment happens to serve the bucket today; the key is what the bucket
    -- is actually addressed by, and it is what a delete needs.
    "storage_path" "text" NOT NULL,
    "caption" character varying(200),
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "uploaded_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."EVENT_PHOTO" OWNER TO "postgres";


ALTER TABLE "public"."EVENT_PHOTO" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."EVENT_PHOTO_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


ALTER TABLE ONLY "public"."EVENT_PHOTO"
    ADD CONSTRAINT "EVENT_PHOTO_pkey" PRIMARY KEY ("id");

-- One row per object. An upload that stored its bytes but failed before its row
-- landed is retried against the same key; without this the retry leaves two
-- rows pointing at one object, and deleting either breaks the other.
ALTER TABLE ONLY "public"."EVENT_PHOTO"
    ADD CONSTRAINT "EVENT_PHOTO_storage_path_key" UNIQUE ("storage_path");

-- Deleting the event takes its photo rows with it. The objects behind them are
-- swept separately, by deleteEvent, which has to list them before the rows go.
ALTER TABLE ONLY "public"."EVENT_PHOTO"
    ADD CONSTRAINT "EVENT_PHOTO_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;

-- A departing staff member does not take the event's archive with them.
ALTER TABLE ONLY "public"."EVENT_PHOTO"
    ADD CONSTRAINT "EVENT_PHOTO_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;

-- Every read of this table is "the photos of one event, in order". Leading with
-- event_id and carrying the sort key serves that from the index alone.
CREATE INDEX IF NOT EXISTS "idx_event_photo_event_sequence"
    ON "public"."EVENT_PHOTO" USING "btree" ("event_id", "sequence_order", "id");


ALTER TABLE "public"."EVENT_PHOTO" ENABLE ROW LEVEL SECURITY;

-- A photo is exactly as visible as the event it belongs to, so the rule is
-- delegated rather than restated: "Published events are public" on EVENT is the
-- one definition of published, and this follows it. Writes are service_role
-- only — every mutation goes through a route that has already run the event's
-- own capability check — so there is no INSERT/UPDATE/DELETE policy to keep in
-- step with that check.
CREATE POLICY "Event photos follow their event" ON "public"."EVENT_PHOTO"
    FOR SELECT TO "authenticated", "anon"
    USING (EXISTS (
        SELECT 1 FROM "public"."EVENT" "e"
        WHERE "e"."id" = "EVENT_PHOTO"."event_id"
          AND "e"."status" = ANY (ARRAY['active'::"public"."event_status", 'complete'::"public"."event_status"])
    ));

-- New tables are not auto-exposed to the Data API roles (see config.toml), and
-- an embedded PostgREST select fails whole with 42501 when one table in it is
-- ungranted. `anon` is not optional here: /community renders to visitors with
-- no session, and that is the page this table exists for.
GRANT ALL ON TABLE "public"."EVENT_PHOTO" TO "service_role";
GRANT SELECT ON TABLE "public"."EVENT_PHOTO" TO "anon";
GRANT SELECT ON TABLE "public"."EVENT_PHOTO" TO "authenticated";
