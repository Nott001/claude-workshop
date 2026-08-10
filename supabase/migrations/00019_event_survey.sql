-- ============================================================
-- B-01 Event survey
--
-- The generic survey tables shipped in 00001 (SURVEY, SURVEY_QUESTION,
-- SURVEY_RESPONSE, SURVEY_ANSWER) were never used by code. B-01 repurposes
-- them for the one-shot post-event survey:
--
--   * SURVEY is gutted to one row per surveyed event (id, event_id, sent_at).
--   * SURVEY_QUESTION and SURVEY_ANSWER are dropped entirely: the form is a
--     fixed required rating + optional comment, so the answers live directly on
--     the response row.
--   * SURVEY_RESPONSE gains the per-recipient token, a successful-delivery
--     marker (retries), and the rating/comment columns.
--   * The unused EVENT.facilitator_surveys_enabled column is renamed to
--     survey_enabled for the opt-in.
--
-- Every table was empty, so the destructive column and enum drops lose no
-- data. Access stays service-client only: no new grants, and the tables keep
-- RLS enabled with no policies (deny-by-default).
-- ============================================================

-- The opt-in flag, renamed to say what it actually is.
ALTER TABLE "EVENT"
  RENAME COLUMN facilitator_surveys_enabled TO survey_enabled;

-- Question/answer tables are gone; the form is fixed rating + comment.
DROP TABLE "SURVEY_ANSWER";
DROP TABLE "SURVEY_QUESTION";
DROP TYPE survey_question_type;

-- SURVEY: one row per surveyed event, created when the bulk send runs.
ALTER TABLE "SURVEY"
  DROP COLUMN course_id,
  DROP COLUMN created_by,
  DROP COLUMN title,
  DROP COLUMN description,
  DROP COLUMN is_active,
  ALTER COLUMN event_id SET NOT NULL,
  ADD CONSTRAINT uq_survey_event UNIQUE (event_id);

ALTER TABLE "SURVEY"
  ADD COLUMN sent_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- SURVEY_RESPONSE: per-recipient token, delivery marker, and the answers.
-- submitted_at loses its NOT NULL DEFAULT so an unsubmitted row does not claim
-- a submission time.
ALTER TABLE "SURVEY_RESPONSE"
  ADD COLUMN token VARCHAR NOT NULL UNIQUE,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN rating INT,
  ADD COLUMN comment TEXT,
  ALTER COLUMN submitted_at DROP NOT NULL,
  ALTER COLUMN submitted_at DROP DEFAULT,
  ADD CONSTRAINT chk_survey_rating CHECK (rating BETWEEN 1 AND 5);

-- New transactional email type. The value must not be *used* in this migration:
-- an enum value added by ALTER TYPE is not visible until the transaction ends.
ALTER TYPE email_type ADD VALUE 'event_survey';
