CREATE TYPE support_session_status AS ENUM ('active', 'ended_by_facilitator', 'ended_by_user');

CREATE TABLE "SUPPORT_SESSIONS" (
  session_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USERS"(user_id) ON DELETE CASCADE,
  status support_session_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_support_sessions_active_user ON "SUPPORT_SESSIONS"(user_id) WHERE status = 'active';

ALTER PUBLICATION supabase_realtime ADD TABLE "SUPPORT_SESSIONS";
