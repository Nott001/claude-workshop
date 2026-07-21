-- Remove registration_confirmation from email_type enum.
-- Existing records with that value are migrated to ticket_issued.

ALTER TABLE "EMAIL_LOGS" ALTER COLUMN email_type TYPE text;

DROP TYPE email_type;

CREATE TYPE email_type AS ENUM ('ticket_issued', 'check_in_confirmed');

UPDATE "EMAIL_LOGS"
SET email_type = 'ticket_issued'
WHERE email_type = 'registration_confirmation';

ALTER TABLE "EMAIL_LOGS"
ALTER COLUMN email_type TYPE email_type
USING email_type::email_type;
