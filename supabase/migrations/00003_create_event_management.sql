CREATE TABLE "EVENTS" (
  event_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INT UNIQUE REFERENCES "COURSE" (course_id),
  title VARCHAR NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_address TEXT,
  venue_name VARCHAR NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_time CHECK (start_time < end_time)
);

CREATE INDEX idx_events_event_date ON "EVENTS" (event_date);

CREATE TABLE "SPEAKER_PROFILES" (
  speaker_profile_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES "USERS" (user_id),
  bio TEXT,
  photo_url VARCHAR,
  designation VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "EVENT_SPEAKERS" (
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id) ON DELETE CASCADE,
  speaker_profile_id INT NOT NULL REFERENCES "SPEAKER_PROFILES" (speaker_profile_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, speaker_profile_id)
);

CREATE INDEX idx_event_speakers_profile ON "EVENT_SPEAKERS" (speaker_profile_id);
