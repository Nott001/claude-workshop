CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TYPE ticket_status AS ENUM ('issued', 'checked_in', 'cancelled');

ALTER TABLE "EVENTS"
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'PHP';

ALTER TABLE "EVENTS"
  ADD CONSTRAINT chk_events_price_nonneg CHECK (price >= 0);

CREATE TABLE "PAYMENTS" (
  payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id),
  hitpay_reference_id VARCHAR UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "PAYMENTS"
  ADD CONSTRAINT chk_payments_amount_nonneg CHECK (amount >= 0);

CREATE INDEX idx_payments_user_event ON "PAYMENTS" (user_id, event_id);
CREATE INDEX idx_payments_status ON "PAYMENTS" (status);

CREATE TABLE "TICKETS" (
  payment_id INT NOT NULL PRIMARY KEY REFERENCES "PAYMENTS" (payment_id),
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id),
  qr_token VARCHAR NOT NULL UNIQUE,
  status ticket_status NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by INT REFERENCES "USERS" (user_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user_event ON "TICKETS" (user_id, event_id);
CREATE INDEX idx_tickets_qr_token ON "TICKETS" (qr_token);
