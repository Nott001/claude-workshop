-- Sourced from the replay of the original 00001–00021 chain.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- 00008 revoked CREATE from the client roles; the ACL must not re-grant it.
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'event.created',
    'event.updated',
    'event.deleted',
    'event.published',
    'speaker.assigned',
    'speaker.unassigned',
    'organization.invited',
    'organization.role_changed',
    'organization.removed',
    'checkin.performed',
    'course.created',
    'course.updated',
    'course.deleted',
    'module.created',
    'module.updated',
    'module.deleted',
    'lesson.created',
    'lesson.updated',
    'lesson.deleted',
    'auth.password_reset_completed'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."content_type" AS ENUM (
    'pdf',
    'video',
    'image',
    'link'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE TYPE "public"."email_status" AS ENUM (
    'sent',
    'failed'
);


ALTER TYPE "public"."email_status" OWNER TO "postgres";


CREATE TYPE "public"."email_type" AS ENUM (
    'ticket_issued',
    'check_in_confirmed',
    'event_survey'
);


ALTER TYPE "public"."email_type" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'draft',
    'active',
    'complete'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."staff_invite_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."staff_invite_status" OWNER TO "postgres";


CREATE TYPE "public"."support_session_status" AS ENUM (
    'active',
    'ended_by_facilitator'
);


ALTER TYPE "public"."support_session_status" OWNER TO "postgres";


CREATE TYPE "public"."support_type" AS ENUM (
    'general'
);


ALTER TYPE "public"."support_type" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'issued',
    'checked_in',
    'cancelled'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'attendee',
    'speaker',
    'facilitator',
    'admin',
    'super_admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."conversation_participant"("target_user_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    target_user_id = me.id
    OR EXISTS (
      SELECT 1 FROM "CHAT_MESSAGE" m
      WHERE (m.user_id = target_user_id OR m.recipient_user_id = target_user_id)
        AND (
          m.user_id = me.id
          OR m.recipient_user_id = me.id
          OR (m.support_type = 'general' AND me.role IN ('admin', 'super_admin'))
        )
    )
    OR EXISTS (
      SELECT 1 FROM "QA_MESSAGE" qa
      WHERE qa.user_id = target_user_id
        AND (
          qa.user_id = me.id
          OR EXISTS (
            SELECT 1 FROM "EVENT_FACILITATOR" ef
            WHERE ef.event_id = qa.event_id AND ef.user_id = me.id
          )
          OR EXISTS (
            SELECT 1 FROM "SPEAKER_PROFILE" sp
            JOIN "EVENT_SPEAKER" es ON es.speaker_profile_id = sp.id
            WHERE es.event_id = qa.event_id AND sp.user_id = me.id
          )
          OR EXISTS (
            SELECT 1 FROM "TICKET" t
            WHERE t.event_id = qa.event_id AND t.user_id = me.id
          )
        )
    )
  FROM "USER" me
  WHERE me.auth_user_id = auth.uid()
$$;


ALTER FUNCTION "public"."conversation_participant"("target_user_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_qa_on_event_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status <> 'complete') THEN
    DELETE FROM "QA_MESSAGE"
    WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."delete_qa_on_event_complete"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."AUDIT_LOG" (
    "id" integer NOT NULL,
    "actor_id" integer,
    "action" "public"."audit_action" NOT NULL,
    "entity_type" character varying NOT NULL,
    "entity_id" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."AUDIT_LOG" OWNER TO "postgres";


ALTER TABLE "public"."AUDIT_LOG" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."AUDIT_LOG_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."CHAT_MESSAGE" (
    "id" integer NOT NULL,
    "user_id" integer,
    "recipient_user_id" integer,
    "message" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_by" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "session_id" integer,
    "deleted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "support_type" "public"."support_type" DEFAULT 'general'::"public"."support_type" NOT NULL
);


ALTER TABLE "public"."CHAT_MESSAGE" OWNER TO "postgres";


ALTER TABLE "public"."CHAT_MESSAGE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."CHAT_MESSAGE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."COMMUNITY_LINK" (
    "id" integer NOT NULL,
    "label" character varying NOT NULL,
    "url" character varying NOT NULL,
    "icon_url" character varying,
    "sequence_order" integer NOT NULL,
    "created_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "is_hidden" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."COMMUNITY_LINK" OWNER TO "postgres";


ALTER TABLE "public"."COMMUNITY_LINK" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."COMMUNITY_LINK_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."COURSE" (
    "id" integer NOT NULL,
    "course_name" character varying NOT NULL,
    "course_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" integer NOT NULL
);


ALTER TABLE "public"."COURSE" OWNER TO "postgres";


ALTER TABLE "public"."COURSE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."COURSE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."EMAIL_LOG" (
    "id" integer NOT NULL,
    "user_id" integer,
    "email_type" "public"."email_type" NOT NULL,
    "status" "public"."email_status" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."EMAIL_LOG" OWNER TO "postgres";


ALTER TABLE "public"."EMAIL_LOG" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."EMAIL_LOG_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."EVENT" (
    "id" integer NOT NULL,
    "title" character varying NOT NULL,
    "event_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "venue_address" "text",
    "venue_name" character varying NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'PHP'::character varying NOT NULL,
    "cover_image_url" character varying,
    "status" "public"."event_status" DEFAULT 'draft'::"public"."event_status" NOT NULL,
    "survey_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_event_price_nonneg" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "chk_event_time" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."EVENT" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EVENT_FACILITATOR" (
    "event_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "assigned_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."EVENT_FACILITATOR" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EVENT_SPEAKER" (
    "event_id" integer NOT NULL,
    "speaker_profile_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."EVENT_SPEAKER" OWNER TO "postgres";


ALTER TABLE "public"."EVENT" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."EVENT_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."LESSON" (
    "id" integer NOT NULL,
    "module_id" integer NOT NULL,
    "description" character varying NOT NULL,
    "content_type" "public"."content_type" NOT NULL,
    "content_url" character varying,
    "sequence_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."LESSON" OWNER TO "postgres";


ALTER TABLE "public"."LESSON" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."LESSON_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."LIVE_SESSION_STATE" (
    "highlighted_lesson_id" integer,
    "updated_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "course_id" integer NOT NULL
);


ALTER TABLE "public"."LIVE_SESSION_STATE" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MODULE" (
    "id" integer NOT NULL,
    "course_id" integer NOT NULL,
    "module_name" character varying NOT NULL,
    "sequence_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "module_type" "text" DEFAULT 'lessons'::"text" NOT NULL,
    "is_locked" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "speaker_profile_id" integer,
    CONSTRAINT "chk_module_schedule" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time"))))
);


ALTER TABLE "public"."MODULE" OWNER TO "postgres";


ALTER TABLE "public"."MODULE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."MODULE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."PASSWORD_RESET_ATTEMPT" (
    "id" integer NOT NULL,
    "email" character varying NOT NULL,
    "ip" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."PASSWORD_RESET_ATTEMPT" OWNER TO "postgres";


ALTER TABLE "public"."PASSWORD_RESET_ATTEMPT" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."PASSWORD_RESET_ATTEMPT_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."PAYMENT" (
    "id" integer NOT NULL,
    "user_id" integer,
    "event_id" integer NOT NULL,
    "gateway_reference_id" character varying,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "paid_at" timestamp with time zone,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'PHP'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_payment_amount_nonneg" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."PAYMENT" OWNER TO "postgres";


ALTER TABLE "public"."PAYMENT" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."PAYMENT_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."QA_MESSAGE" (
    "id" integer NOT NULL,
    "event_id" integer NOT NULL,
    "user_id" integer,
    "message" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "module_id" integer NOT NULL
);


ALTER TABLE "public"."QA_MESSAGE" OWNER TO "postgres";


ALTER TABLE "public"."QA_MESSAGE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."QA_MESSAGE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."SPEAKER_PROFILE" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "bio" "text",
    "designation" character varying,
    "linkedin_url" character varying,
    "twitter_url" character varying,
    "github_url" character varying,
    "website_url" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."SPEAKER_PROFILE" OWNER TO "postgres";


ALTER TABLE "public"."SPEAKER_PROFILE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."SPEAKER_PROFILE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."STAFF_INVITE" (
    "id" integer NOT NULL,
    "email" character varying NOT NULL,
    "full_name" character varying NOT NULL,
    "invited_role" "public"."user_role" NOT NULL,
    "event_id" integer NOT NULL,
    "invited_by" integer NOT NULL,
    "requires_approval" boolean DEFAULT false NOT NULL,
    "approved_by" integer,
    "status" "public"."staff_invite_status" DEFAULT 'pending'::"public"."staff_invite_status" NOT NULL,
    "external_id" character varying,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."STAFF_INVITE" OWNER TO "postgres";


ALTER TABLE "public"."STAFF_INVITE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."STAFF_INVITE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."SUPPORT_SESSION" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "status" "public"."support_session_status" DEFAULT 'active'::"public"."support_session_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "support_type" "public"."support_type" DEFAULT 'general'::"public"."support_type" NOT NULL,
    "case_number" bigint NOT NULL,
    "assigned_to" integer
);


ALTER TABLE "public"."SUPPORT_SESSION" OWNER TO "postgres";


ALTER TABLE "public"."SUPPORT_SESSION" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."SUPPORT_SESSION_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."SURVEY" (
    "id" integer NOT NULL,
    "event_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."SURVEY" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SURVEY_RESPONSE" (
    "id" integer NOT NULL,
    "survey_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "token" character varying NOT NULL,
    "sent_at" timestamp with time zone,
    "rating" integer,
    "comment" "text",
    CONSTRAINT "chk_survey_rating" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."SURVEY_RESPONSE" OWNER TO "postgres";


ALTER TABLE "public"."SURVEY_RESPONSE" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."SURVEY_RESPONSE_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."SURVEY" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."SURVEY_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."SYSTEM_SETTING" (
    "setting_key" character varying NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "updated_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."SYSTEM_SETTING" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."TICKET" (
    "id" integer NOT NULL,
    "payment_id" integer,
    "user_id" integer,
    "event_id" integer NOT NULL,
    "qr_token" character varying NOT NULL,
    "status" "public"."ticket_status" DEFAULT 'issued'::"public"."ticket_status" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_in_by" integer,
    "checked_in_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."TICKET" OWNER TO "postgres";


ALTER TABLE "public"."TICKET" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."TICKET_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."USER" (
    "id" integer NOT NULL,
    "full_name" character varying NOT NULL,
    "email" character varying NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'attendee'::"public"."user_role" NOT NULL,
    "profile_image_url" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."USER" OWNER TO "postgres";


ALTER TABLE "public"."USER" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."USER_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."support_case_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."support_case_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."support_case_seq" OWNED BY "public"."SUPPORT_SESSION"."id";



ALTER TABLE ONLY "public"."SUPPORT_SESSION" ALTER COLUMN "case_number" SET DEFAULT "nextval"('"public"."support_case_seq"'::"regclass");



ALTER TABLE ONLY "public"."AUDIT_LOG"
    ADD CONSTRAINT "AUDIT_LOG_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."CHAT_MESSAGE"
    ADD CONSTRAINT "CHAT_MESSAGE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."COMMUNITY_LINK"
    ADD CONSTRAINT "COMMUNITY_LINK_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."COURSE"
    ADD CONSTRAINT "COURSE_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."COURSE"
    ADD CONSTRAINT "COURSE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EMAIL_LOG"
    ADD CONSTRAINT "EMAIL_LOG_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EVENT_FACILITATOR"
    ADD CONSTRAINT "EVENT_FACILITATOR_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."EVENT_SPEAKER"
    ADD CONSTRAINT "EVENT_SPEAKER_pkey" PRIMARY KEY ("event_id", "speaker_profile_id");



ALTER TABLE ONLY "public"."EVENT"
    ADD CONSTRAINT "EVENT_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."LESSON"
    ADD CONSTRAINT "LESSON_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."LIVE_SESSION_STATE"
    ADD CONSTRAINT "LIVE_SESSION_STATE_pkey" PRIMARY KEY ("course_id");



ALTER TABLE ONLY "public"."MODULE"
    ADD CONSTRAINT "MODULE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PASSWORD_RESET_ATTEMPT"
    ADD CONSTRAINT "PASSWORD_RESET_ATTEMPT_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PAYMENT"
    ADD CONSTRAINT "PAYMENT_gateway_reference_id_key" UNIQUE ("gateway_reference_id");



ALTER TABLE ONLY "public"."PAYMENT"
    ADD CONSTRAINT "PAYMENT_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."QA_MESSAGE"
    ADD CONSTRAINT "QA_MESSAGE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SPEAKER_PROFILE"
    ADD CONSTRAINT "SPEAKER_PROFILE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SPEAKER_PROFILE"
    ADD CONSTRAINT "SPEAKER_PROFILE_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."STAFF_INVITE"
    ADD CONSTRAINT "STAFF_INVITE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SUPPORT_SESSION"
    ADD CONSTRAINT "SUPPORT_SESSION_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SURVEY_RESPONSE"
    ADD CONSTRAINT "SURVEY_RESPONSE_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SURVEY_RESPONSE"
    ADD CONSTRAINT "SURVEY_RESPONSE_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."SURVEY"
    ADD CONSTRAINT "SURVEY_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SYSTEM_SETTING"
    ADD CONSTRAINT "SYSTEM_SETTING_pkey" PRIMARY KEY ("setting_key");



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_qr_token_key" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."USER"
    ADD CONSTRAINT "USER_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."USER"
    ADD CONSTRAINT "USER_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."USER"
    ADD CONSTRAINT "USER_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SUPPORT_SESSION"
    ADD CONSTRAINT "support_session_case_number_unique" UNIQUE ("case_number");



ALTER TABLE ONLY "public"."SURVEY"
    ADD CONSTRAINT "uq_survey_event" UNIQUE ("event_id");



CREATE INDEX "idx_audit_log_actor" ON "public"."AUDIT_LOG" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_log_created" ON "public"."AUDIT_LOG" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_entity" ON "public"."AUDIT_LOG" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_chat_message_recipient" ON "public"."CHAT_MESSAGE" USING "btree" ("recipient_user_id");



CREATE INDEX "idx_email_log_sent_at" ON "public"."EMAIL_LOG" USING "btree" ("sent_at");



CREATE INDEX "idx_email_log_status" ON "public"."EMAIL_LOG" USING "btree" ("status");



CREATE INDEX "idx_email_log_type" ON "public"."EMAIL_LOG" USING "btree" ("email_type");



CREATE INDEX "idx_email_log_user" ON "public"."EMAIL_LOG" USING "btree" ("user_id");



CREATE INDEX "idx_event_date" ON "public"."EVENT" USING "btree" ("event_date");



CREATE INDEX "idx_event_speaker_profile" ON "public"."EVENT_SPEAKER" USING "btree" ("speaker_profile_id");



CREATE INDEX "idx_event_status" ON "public"."EVENT" USING "btree" ("status");



CREATE INDEX "idx_lesson_module_sequence" ON "public"."LESSON" USING "btree" ("module_id", "sequence_order");



CREATE INDEX "idx_module_course_sequence" ON "public"."MODULE" USING "btree" ("course_id", "sequence_order");



CREATE INDEX "idx_password_reset_attempt_email" ON "public"."PASSWORD_RESET_ATTEMPT" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "idx_password_reset_attempt_ip" ON "public"."PASSWORD_RESET_ATTEMPT" USING "btree" ("ip", "created_at" DESC);



CREATE INDEX "idx_payment_status" ON "public"."PAYMENT" USING "btree" ("status");



CREATE INDEX "idx_payment_user_event" ON "public"."PAYMENT" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_qa_message_module" ON "public"."QA_MESSAGE" USING "btree" ("module_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_support_session_active" ON "public"."SUPPORT_SESSION" USING "btree" ("user_id", "support_type") WHERE ("status" = 'active'::"public"."support_session_status");



CREATE INDEX "idx_support_session_assigned" ON "public"."SUPPORT_SESSION" USING "btree" ("assigned_to") WHERE ("status" = 'active'::"public"."support_session_status");



CREATE INDEX "idx_support_session_user_created" ON "public"."SUPPORT_SESSION" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ticket_qr" ON "public"."TICKET" USING "btree" ("qr_token");



CREATE INDEX "idx_ticket_user_event" ON "public"."TICKET" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_user_role" ON "public"."USER" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "trg_delete_qa_on_event_complete" AFTER UPDATE OF "status" ON "public"."EVENT" FOR EACH ROW WHEN (("new"."status" = 'complete'::"public"."event_status")) EXECUTE FUNCTION "public"."delete_qa_on_event_complete"();



ALTER TABLE ONLY "public"."AUDIT_LOG"
    ADD CONSTRAINT "AUDIT_LOG_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."CHAT_MESSAGE"
    ADD CONSTRAINT "CHAT_MESSAGE_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."CHAT_MESSAGE"
    ADD CONSTRAINT "CHAT_MESSAGE_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."SUPPORT_SESSION"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."CHAT_MESSAGE"
    ADD CONSTRAINT "CHAT_MESSAGE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."COMMUNITY_LINK"
    ADD CONSTRAINT "COMMUNITY_LINK_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."COURSE"
    ADD CONSTRAINT "COURSE_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EMAIL_LOG"
    ADD CONSTRAINT "EMAIL_LOG_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EVENT_FACILITATOR"
    ADD CONSTRAINT "EVENT_FACILITATOR_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."EVENT_FACILITATOR"
    ADD CONSTRAINT "EVENT_FACILITATOR_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EVENT_FACILITATOR"
    ADD CONSTRAINT "EVENT_FACILITATOR_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EVENT_SPEAKER"
    ADD CONSTRAINT "EVENT_SPEAKER_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EVENT_SPEAKER"
    ADD CONSTRAINT "EVENT_SPEAKER_speaker_profile_id_fkey" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."SPEAKER_PROFILE"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."LESSON"
    ADD CONSTRAINT "LESSON_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."MODULE"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."LIVE_SESSION_STATE"
    ADD CONSTRAINT "LIVE_SESSION_STATE_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."COURSE"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."LIVE_SESSION_STATE"
    ADD CONSTRAINT "LIVE_SESSION_STATE_highlighted_lesson_id_fkey" FOREIGN KEY ("highlighted_lesson_id") REFERENCES "public"."LESSON"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."LIVE_SESSION_STATE"
    ADD CONSTRAINT "LIVE_SESSION_STATE_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."MODULE"
    ADD CONSTRAINT "MODULE_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."COURSE"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MODULE"
    ADD CONSTRAINT "MODULE_speaker_profile_id_fkey" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."SPEAKER_PROFILE"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PAYMENT"
    ADD CONSTRAINT "PAYMENT_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id");



ALTER TABLE ONLY "public"."PAYMENT"
    ADD CONSTRAINT "PAYMENT_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."QA_MESSAGE"
    ADD CONSTRAINT "QA_MESSAGE_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."QA_MESSAGE"
    ADD CONSTRAINT "QA_MESSAGE_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."MODULE"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."QA_MESSAGE"
    ADD CONSTRAINT "QA_MESSAGE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."SPEAKER_PROFILE"
    ADD CONSTRAINT "SPEAKER_PROFILE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."STAFF_INVITE"
    ADD CONSTRAINT "STAFF_INVITE_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."STAFF_INVITE"
    ADD CONSTRAINT "STAFF_INVITE_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."STAFF_INVITE"
    ADD CONSTRAINT "STAFF_INVITE_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."USER"("id");



ALTER TABLE ONLY "public"."SUPPORT_SESSION"
    ADD CONSTRAINT "SUPPORT_SESSION_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."SUPPORT_SESSION"
    ADD CONSTRAINT "SUPPORT_SESSION_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SURVEY_RESPONSE"
    ADD CONSTRAINT "SURVEY_RESPONSE_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."SURVEY"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SURVEY_RESPONSE"
    ADD CONSTRAINT "SURVEY_RESPONSE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id");



ALTER TABLE ONLY "public"."SURVEY"
    ADD CONSTRAINT "SURVEY_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SYSTEM_SETTING"
    ADD CONSTRAINT "SYSTEM_SETTING_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."USER"("id");



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."EVENT"("id");



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."PAYMENT"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."TICKET"
    ADD CONSTRAINT "TICKET_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."USER"("id") ON DELETE SET NULL;



ALTER TABLE "public"."AUDIT_LOG" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."CHAT_MESSAGE" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."COMMUNITY_LINK" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."COURSE" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Community links visible unless hidden" ON "public"."COMMUNITY_LINK" FOR SELECT TO "authenticated", "anon" USING ((("is_hidden" = false) OR (EXISTS ( SELECT 1
   FROM "public"."USER" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))));



CREATE POLICY "Courses visible to authenticated" ON "public"."COURSE" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."EMAIL_LOG" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EVENT" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EVENT_FACILITATOR" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EVENT_SPEAKER" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Facilitator assignments visible" ON "public"."EVENT_FACILITATOR" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."LESSON" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."LIVE_SESSION_STATE" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Lessons visible to authenticated" ON "public"."LESSON" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Live state visible to all" ON "public"."LIVE_SESSION_STATE" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."MODULE" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Modules visible to authenticated" ON "public"."MODULE" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."PASSWORD_RESET_ATTEMPT" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PAYMENT" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Published events are public" ON "public"."EVENT" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['active'::"public"."event_status", 'complete'::"public"."event_status"])));



ALTER TABLE "public"."QA_MESSAGE" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SPEAKER_PROFILE" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."STAFF_INVITE" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SUPPORT_SESSION" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SURVEY" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SURVEY_RESPONSE" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SYSTEM_SETTING" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Speaker assignments visible" ON "public"."EVENT_SPEAKER" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Speaker profiles are public" ON "public"."SPEAKER_PROFILE" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Staff see unpublished events" ON "public"."EVENT" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['active'::"public"."event_status", 'complete'::"public"."event_status"])) OR (EXISTS ( SELECT 1
   FROM "public"."USER" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role" = ANY (ARRAY['facilitator'::"public"."user_role", 'admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))) OR (EXISTS ( SELECT 1
   FROM ("public"."USER" "u"
     JOIN "public"."EVENT_FACILITATOR" "ef" ON (("ef"."user_id" = "u"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("ef"."event_id" = "EVENT"."id"))))));



ALTER TABLE "public"."TICKET" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."USER" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users read Q&A messages for their modules" ON "public"."QA_MESSAGE" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."USER" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("u"."id" = "QA_MESSAGE"."user_id") OR (EXISTS ( SELECT 1
           FROM "public"."EVENT_FACILITATOR" "ef"
          WHERE (("ef"."event_id" = "QA_MESSAGE"."event_id") AND ("ef"."user_id" = "u"."id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."SPEAKER_PROFILE" "sp"
             JOIN "public"."EVENT_SPEAKER" "es" ON (("es"."speaker_profile_id" = "sp"."id")))
          WHERE (("es"."event_id" = "QA_MESSAGE"."event_id") AND ("sp"."user_id" = "u"."id")))) OR (EXISTS ( SELECT 1
           FROM "public"."TICKET" "t"
          WHERE (("t"."event_id" = "QA_MESSAGE"."event_id") AND ("t"."user_id" = "u"."id")))))))));



CREATE POLICY "Users read conversation participants" ON "public"."USER" FOR SELECT TO "authenticated" USING ("public"."conversation_participant"("id"));



CREATE POLICY "Users read support messages" ON "public"."CHAT_MESSAGE" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."USER" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("u"."id" = "CHAT_MESSAGE"."user_id") OR ("u"."id" = "CHAT_MESSAGE"."recipient_user_id") OR (("CHAT_MESSAGE"."support_type" = 'general'::"public"."support_type") AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))))));



CREATE POLICY "Users see own support sessions" ON "public"."SUPPORT_SESSION" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."USER" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("u"."id" = "SUPPORT_SESSION"."user_id") OR (("SUPPORT_SESSION"."support_type" = 'general'::"public"."support_type") AND ("u"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))))));



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."AUDIT_LOG" TO "service_role";



GRANT ALL ON TABLE "public"."CHAT_MESSAGE" TO "service_role";
GRANT SELECT ON TABLE "public"."CHAT_MESSAGE" TO "authenticated";



GRANT ALL ON TABLE "public"."COMMUNITY_LINK" TO "service_role";
GRANT SELECT ON TABLE "public"."COMMUNITY_LINK" TO "anon";
GRANT SELECT ON TABLE "public"."COMMUNITY_LINK" TO "authenticated";



GRANT ALL ON TABLE "public"."COURSE" TO "service_role";
GRANT SELECT ON TABLE "public"."COURSE" TO "authenticated";



GRANT ALL ON TABLE "public"."EMAIL_LOG" TO "service_role";



GRANT ALL ON TABLE "public"."EVENT" TO "service_role";
GRANT SELECT ON TABLE "public"."EVENT" TO "anon";
GRANT SELECT ON TABLE "public"."EVENT" TO "authenticated";



GRANT ALL ON TABLE "public"."EVENT_FACILITATOR" TO "service_role";
GRANT SELECT ON TABLE "public"."EVENT_FACILITATOR" TO "authenticated";



GRANT ALL ON TABLE "public"."EVENT_SPEAKER" TO "service_role";
GRANT SELECT ON TABLE "public"."EVENT_SPEAKER" TO "authenticated";



GRANT ALL ON TABLE "public"."LESSON" TO "service_role";
GRANT SELECT ON TABLE "public"."LESSON" TO "authenticated";



GRANT ALL ON TABLE "public"."LIVE_SESSION_STATE" TO "service_role";
GRANT SELECT ON TABLE "public"."LIVE_SESSION_STATE" TO "anon";
GRANT SELECT ON TABLE "public"."LIVE_SESSION_STATE" TO "authenticated";



GRANT ALL ON TABLE "public"."MODULE" TO "service_role";
GRANT SELECT ON TABLE "public"."MODULE" TO "authenticated";



GRANT ALL ON TABLE "public"."PASSWORD_RESET_ATTEMPT" TO "service_role";



GRANT ALL ON TABLE "public"."PAYMENT" TO "service_role";



GRANT ALL ON TABLE "public"."QA_MESSAGE" TO "service_role";
GRANT SELECT ON TABLE "public"."QA_MESSAGE" TO "authenticated";



GRANT ALL ON TABLE "public"."SPEAKER_PROFILE" TO "service_role";
GRANT SELECT ON TABLE "public"."SPEAKER_PROFILE" TO "anon";
GRANT SELECT ON TABLE "public"."SPEAKER_PROFILE" TO "authenticated";



GRANT ALL ON TABLE "public"."STAFF_INVITE" TO "service_role";



GRANT ALL ON TABLE "public"."SUPPORT_SESSION" TO "service_role";
GRANT SELECT ON TABLE "public"."SUPPORT_SESSION" TO "authenticated";



GRANT ALL ON TABLE "public"."SURVEY" TO "service_role";



GRANT ALL ON TABLE "public"."SURVEY_RESPONSE" TO "service_role";



GRANT ALL ON TABLE "public"."SYSTEM_SETTING" TO "service_role";



GRANT ALL ON TABLE "public"."TICKET" TO "service_role";



GRANT ALL ON TABLE "public"."USER" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."USER" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."USER" TO "authenticated";



GRANT SELECT("auth_user_id") ON TABLE "public"."USER" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."USER" TO "authenticated";



GRANT USAGE ON SEQUENCE "public"."support_case_seq" TO "service_role";





ALTER PUBLICATION supabase_realtime ADD TABLE "public"."MODULE";
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."TICKET";
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."SUPPORT_SESSION";
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CHAT_MESSAGE";
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."QA_MESSAGE";
