CREATE TYPE content_type AS ENUM ('pdf', 'video', 'image', 'link');

CREATE TABLE "COURSE" (
  course_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_name VARCHAR NOT NULL,
  course_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "MODULES" (
  module_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id INT NOT NULL REFERENCES "COURSE" (course_id) ON DELETE CASCADE,
  module_name VARCHAR NOT NULL,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_modules_course_sequence ON "MODULES" (course_id, sequence_order);

CREATE TABLE "LESSONS" (
  lesson_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_id INT NOT NULL REFERENCES "MODULES" (module_id) ON DELETE CASCADE,
  description VARCHAR NOT NULL,
  content_type content_type NOT NULL,
  content_url VARCHAR NOT NULL,
  total_units INT NOT NULL DEFAULT 1,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_module_sequence ON "LESSONS" (module_id, sequence_order);

CREATE TABLE "LESSON_PROGRESS" (
  lesson_id INT NOT NULL REFERENCES "LESSONS" (lesson_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES "USERS" (user_id) ON DELETE CASCADE,
  units_completed INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, user_id)
);
