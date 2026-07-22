CREATE TYPE support_session_status_new AS ENUM ('active', 'ended_by_facilitator');

ALTER TABLE "SUPPORT_SESSIONS"
  ALTER COLUMN status TYPE support_session_status_new
    USING (status::text::support_session_status_new);

DROP TYPE support_session_status;

ALTER TYPE support_session_status_new RENAME TO support_session_status;
