CREATE TYPE submitted_type AS ENUM ('text', 'multiple_choice', 'rating');

CREATE TABLE "SURVEYS" (
  survey_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "SURVEY_QUESTIONS" (
  question_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id INT NOT NULL REFERENCES "SURVEYS" (survey_id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  submitted_type submitted_type NOT NULL,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_questions_order ON "SURVEY_QUESTIONS" (survey_id, sequence_order);

CREATE TABLE "SURVEY_RESPONSES" (
  response_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id INT NOT NULL REFERENCES "SURVEYS" (survey_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);

CREATE TABLE "SURVEY_ANSWERS" (
  answer_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id INT NOT NULL REFERENCES "SURVEY_RESPONSES" (response_id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES "SURVEY_QUESTIONS" (question_id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_value INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);