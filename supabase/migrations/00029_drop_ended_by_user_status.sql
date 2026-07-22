ALTER TABLE "SUPPORT_SESSIONS" ALTER COLUMN status DROP DEFAULT;

DROP INDEX IF EXISTS idx_support_sessions_active_user;

CREATE TYPE support_session_status_new AS ENUM ('active', 'ended_by_facilitator');

ALTER TABLE "SUPPORT_SESSIONS"
  ALTER COLUMN status TYPE support_session_status_new
    USING (status::text::support_session_status_new);

DROP TYPE support_session_status;

ALTER TYPE support_session_status_new RENAME TO support_session_status;

ALTER TABLE "SUPPORT_SESSIONS" ALTER COLUMN status SET DEFAULT 'active';

CREATE UNIQUE INDEX idx_support_sessions_active_user ON "SUPPORT_SESSIONS"(user_id) WHERE status = 'active';
