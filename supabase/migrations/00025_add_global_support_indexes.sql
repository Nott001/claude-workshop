DROP INDEX IF EXISTS idx_chat_messages_event_channel;

CREATE INDEX idx_chat_messages_event_channel ON "CHAT_MESSAGES" (event_id, channel, sent_at DESC);
CREATE INDEX idx_chat_messages_global_support ON "CHAT_MESSAGES" (channel, user_id, sent_at DESC) WHERE channel = 'global_support';
