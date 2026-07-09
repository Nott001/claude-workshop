CREATE TYPE user_role AS ENUM ('attendee', 'speaker', 'facilitator');

CREATE TABLE "USERS" (
  user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  clerk_id VARCHAR NOT NULL,
  role user_role NOT NULL DEFAULT 'attendee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email ON "USERS" (email);
CREATE UNIQUE INDEX idx_users_clerk_id ON "USERS" (clerk_id);
CREATE INDEX idx_users_role ON "USERS" (role);
  