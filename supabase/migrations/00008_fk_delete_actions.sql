-- ============================================================
-- Deletable events and users: detach durable records instead
-- of letting NO ACTION FKs turn a delete into a 500.
--
-- Events and staff can currently be deleted in the UI, but every
-- FK declared without an action rule defaults to NO ACTION, so
-- any referenced row blocks the delete:
--   - an event with a payment or ticket 500s on DELETE
--   - a staff member who has ever acted (audit rows, invites,
--     messages, purchases) 500s on removal
--
-- Decision per FK: keep the record, null out the pointer. Cascade
-- would destroy purchase and audit history; RESTRICT would make
-- event deletion and staff removal fail for nearly everyone.
-- ============================================================

-- PAYMENT — keep the financial record, drop the links
ALTER TABLE "PAYMENT" DROP CONSTRAINT "PAYMENT_user_id_fkey";
ALTER TABLE "PAYMENT" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "PAYMENT" ADD CONSTRAINT "PAYMENT_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "PAYMENT" DROP CONSTRAINT "PAYMENT_event_id_fkey";
ALTER TABLE "PAYMENT" ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE "PAYMENT" ADD CONSTRAINT "PAYMENT_event_id_fkey"
  FOREIGN KEY (event_id) REFERENCES "EVENT"(id) ON DELETE SET NULL;

-- TICKET — the entitlement row survives its event and its owner
ALTER TABLE "TICKET" DROP CONSTRAINT "TICKET_user_id_fkey";
ALTER TABLE "TICKET" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "TICKET" ADD CONSTRAINT "TICKET_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "TICKET" DROP CONSTRAINT "TICKET_event_id_fkey";
ALTER TABLE "TICKET" ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE "TICKET" ADD CONSTRAINT "TICKET_event_id_fkey"
  FOREIGN KEY (event_id) REFERENCES "EVENT"(id) ON DELETE SET NULL;

-- AUDIT_LOG — immutable by nature; never delete the log, only the actor link
ALTER TABLE "AUDIT_LOG" DROP CONSTRAINT "AUDIT_LOG_actor_id_fkey";
ALTER TABLE "AUDIT_LOG" ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE "AUDIT_LOG" ADD CONSTRAINT "AUDIT_LOG_actor_id_fkey"
  FOREIGN KEY (actor_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- STAFF_INVITE — the invite stands on its own once sent
ALTER TABLE "STAFF_INVITE" DROP CONSTRAINT "STAFF_INVITE_invited_by_fkey";
ALTER TABLE "STAFF_INVITE" ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE "STAFF_INVITE" ADD CONSTRAINT "STAFF_INVITE_invited_by_fkey"
  FOREIGN KEY (invited_by) REFERENCES "USER"(id) ON DELETE SET NULL;

-- CHAT_MESSAGE — keep the support thread, drop the author link
ALTER TABLE "CHAT_MESSAGE" DROP CONSTRAINT "CHAT_MESSAGE_user_id_fkey";
ALTER TABLE "CHAT_MESSAGE" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "CHAT_MESSAGE" ADD CONSTRAINT "CHAT_MESSAGE_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- QA_MESSAGE — same as chat: content survives, attribution does not
ALTER TABLE "QA_MESSAGE" DROP CONSTRAINT "QA_MESSAGE_user_id_fkey";
ALTER TABLE "QA_MESSAGE" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "QA_MESSAGE" ADD CONSTRAINT "QA_MESSAGE_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- SURVEY_RESPONSE — keep the response, drop the respondent link
ALTER TABLE "SURVEY_RESPONSE" DROP CONSTRAINT "SURVEY_RESPONSE_user_id_fkey";
ALTER TABLE "SURVEY_RESPONSE" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "SURVEY_RESPONSE" ADD CONSTRAINT "SURVEY_RESPONSE_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- EMAIL_LOG — keep the delivery record
ALTER TABLE "EMAIL_LOG" DROP CONSTRAINT "EMAIL_LOG_user_id_fkey";
ALTER TABLE "EMAIL_LOG" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "EMAIL_LOG" ADD CONSTRAINT "EMAIL_LOG_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- SYSTEM_SETTING.updated_by is already nullable; only the action rule changes
ALTER TABLE "SYSTEM_SETTING" DROP CONSTRAINT "SYSTEM_SETTING_updated_by_fkey";
ALTER TABLE "SYSTEM_SETTING" ADD CONSTRAINT "SYSTEM_SETTING_updated_by_fkey"
  FOREIGN KEY (updated_by) REFERENCES "USER"(id) ON DELETE SET NULL;
