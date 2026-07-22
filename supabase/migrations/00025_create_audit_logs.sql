CREATE TYPE audit_action AS ENUM (
  'event.created',
  'event.updated',
  'event.deleted',
  'event.published',
  'speaker.assigned',
  'speaker.unassigned',
  'organization.invited',
  'organization.role_changed',
  'organization.removed',
  'checkin.performed'
);

CREATE TABLE "AUDIT_LOGS" (
  log_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id INT NOT NULL REFERENCES "USERS"(user_id),
  action audit_action NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id INT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON "AUDIT_LOGS"(actor_id);
CREATE INDEX idx_audit_logs_entity ON "AUDIT_LOGS"(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON "AUDIT_LOGS"(created_at DESC);
