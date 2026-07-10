CREATE TYPE chat_channel AS ENUM ('support', 'live_qa');

CREATE TABLE "CHAT_MESSAGES" (
  message_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id) ON DELETE CASCADE,
  channel chat_channel NOT NULL,
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by INT[] NOT NULL DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_event_channel ON "CHAT_MESSAGES" (event_id, channel, sent_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE "CHAT_MESSAGES";