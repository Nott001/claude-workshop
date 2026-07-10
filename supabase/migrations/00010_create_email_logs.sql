CREATE TYPE email_type AS ENUM ('registration_confirmation', 'ticket_issued', 'check_in_confirmed');

CREATE TYPE email_status AS ENUM ('sent', 'failed');

CREATE TABLE "EMAIL_LOGS" (
  log_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  email_type email_type NOT NULL,
  status email_status NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_user_id ON "EMAIL_LOGS" (user_id);
CREATE INDEX idx_email_logs_email_type ON "EMAIL_LOGS" (email_type);
CREATE INDEX idx_email_logs_status ON "EMAIL_LOGS" (status);
CREATE INDEX idx_email_logs_sent_at ON "EMAIL_LOGS" (sent_at);
