CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TYPE ticket_status AS ENUM ('issued', 'checked_in', 'cancelled');

CREATE TABLE "PAYMENTS" (
  payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USERS" (user_id),
  event_id INT NOT NULL REFERENCES "EVENTS" (event_id),
  hitpay_reference_id VARCHAR UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
