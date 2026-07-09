ALTER TABLE "EVENTS"
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'PHP';

ALTER TABLE "EVENTS"
  ADD CONSTRAINT chk_events_price_nonneg CHECK (price >= 0);

-- 2. Payments: add the amount actually charged (snapshotted at transaction time)
ALTER TABLE "PAYMENTS"
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'PHP';

ALTER TABLE "PAYMENTS"
  ADD CONSTRAINT chk_payments_amount_nonneg CHECK (amount >= 0);
