CREATE INDEX idx_chat_messages_global_support_recipient ON "CHAT_MESSAGES" (channel, recipient_user_id, sent_at DESC) WHERE channel = 'global_support';
