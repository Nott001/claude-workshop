-- ============================================================
-- A deleted user leaves their trail behind
--
-- PAYMENT, TICKET, AUDIT_LOG, EMAIL_LOG, CHAT_MESSAGE and QA_MESSAGE all
-- reference "USER"(id) with no ON DELETE rule, so DELETE FROM "USER" is
-- refused for anyone with an order, an email or an audit row (FK violation,
-- which surfaces as the 500 from /api/organization/[userId]). Re-point those
-- six FKs to ON DELETE SET NULL and free the columns to hold a null, so the
-- account can go while the record keeps its row and the actor is simply
-- unknown.
-- ============================================================

ALTER TABLE "PAYMENT"
  DROP CONSTRAINT "PAYMENT_user_id_fkey",
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT "PAYMENT_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "TICKET"
  DROP CONSTRAINT "TICKET_user_id_fkey",
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT "TICKET_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "AUDIT_LOG"
  DROP CONSTRAINT "AUDIT_LOG_actor_id_fkey",
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD CONSTRAINT "AUDIT_LOG_actor_id_fkey"
    FOREIGN KEY (actor_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "EMAIL_LOG"
  DROP CONSTRAINT "EMAIL_LOG_user_id_fkey",
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT "EMAIL_LOG_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "CHAT_MESSAGE"
  DROP CONSTRAINT "CHAT_MESSAGE_user_id_fkey",
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT "CHAT_MESSAGE_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

ALTER TABLE "QA_MESSAGE"
  DROP CONSTRAINT "QA_MESSAGE_user_id_fkey",
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT "QA_MESSAGE_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES "USER"(id) ON DELETE SET NULL;

-- support_case_seq was created standalone in 00009 with no OWNED BY, so it
-- floats free of any row lifetime. Own it to the support-case primary key so
-- the sequence dies with the table it numbers.
ALTER SEQUENCE support_case_seq OWNED BY "SUPPORT_SESSION".id;
