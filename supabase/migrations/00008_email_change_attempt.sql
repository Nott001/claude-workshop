-- A ledger for the email-change send limiter.
--
-- The gate this replaces read `auth.users.email_change_sent_at` and refused a
-- re-send of the address already pending. Both halves of that were bypassable
-- from the settings UI: the check only fired when the requested address matched
-- the pending one, so varying the address walked straight past it, and
-- `cancel_pending_email_change` (00006) nulls the very column it measured, so
-- Cancel reset the window on purpose. Either one lets a signed-in user spend
-- the project-wide hourly mail budget, which is shared with every signup and
-- password reset in the app.
--
-- A limiter cannot key on state the limited party can clear, nor on the value
-- they are asking about. This counts attempts per caller and per origin,
-- whatever address was named and whether or not a change is still pending.
--
-- Modelled on PASSWORD_RESET_ATTEMPT, including its lack of a foreign key: rows
-- are a transient counter, not relational data, and only the last few minutes
-- of them are ever read. Staying out of the FK graph keeps account teardown
-- from having to know this table exists.

CREATE TABLE IF NOT EXISTS "public"."EMAIL_CHANGE_ATTEMPT" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "ip" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."EMAIL_CHANGE_ATTEMPT" OWNER TO "postgres";

ALTER TABLE "public"."EMAIL_CHANGE_ATTEMPT" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."EMAIL_CHANGE_ATTEMPT_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY "public"."EMAIL_CHANGE_ATTEMPT"
    ADD CONSTRAINT "EMAIL_CHANGE_ATTEMPT_pkey" PRIMARY KEY ("id");

-- Both counts read a key and a recent time range, and the refusal path reads
-- the oldest row of the same slice in ascending order. `created_at DESC` serves
-- all three; the planner reads an index backwards at the same cost.
CREATE INDEX "idx_email_change_attempt_user" ON "public"."EMAIL_CHANGE_ATTEMPT" USING "btree" ("user_id", "created_at" DESC);
CREATE INDEX "idx_email_change_attempt_ip" ON "public"."EMAIL_CHANGE_ATTEMPT" USING "btree" ("ip", "created_at" DESC);

-- RLS on with no policy at all, exactly as PASSWORD_RESET_ATTEMPT is: the
-- counter must not be readable or writable under the caller's own session, or
-- the limited party could inspect and pad their own ledger. Only service_role
-- reaches it, which is the client the route uses for this and nothing else.
ALTER TABLE "public"."EMAIL_CHANGE_ATTEMPT" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."EMAIL_CHANGE_ATTEMPT" TO "service_role";
