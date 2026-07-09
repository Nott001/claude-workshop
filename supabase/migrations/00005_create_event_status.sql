CREATE TYPE event_status AS ENUM ('draft', 'active', 'complete');

ALTER TABLE "EVENTS"
  ADD COLUMN status event_status NOT NULL DEFAULT 'draft';

CREATE INDEX idx_events_status ON "EVENTS" (status);
