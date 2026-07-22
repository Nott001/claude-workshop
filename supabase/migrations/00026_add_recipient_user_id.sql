ALTER TABLE "CHAT_MESSAGES"
  ADD COLUMN recipient_user_id integer REFERENCES "USERS"(user_id);

CREATE INDEX idx_chat_messages_recipient ON "CHAT_MESSAGES" (recipient_user_id, sent_at DESC)
  WHERE recipient_user_id IS NOT NULL;
