-- ============================================================
-- Case numbering and ownership for general support chat
--
-- Every support session gets a global sequential case number when it
-- starts. An admin/super_admin can claim a case, becoming its owner
-- for as long as they hold it, so one staff member handles each chat
-- end to end instead of several replying to the same conversation.
-- ============================================================

CREATE SEQUENCE support_case_seq;

ALTER TABLE "SUPPORT_SESSION"
  ADD COLUMN case_number BIGINT,
  ADD COLUMN assigned_to INT REFERENCES "USER"(id) ON DELETE SET NULL;

-- Number the sessions already in the table, then point the sequence past
-- them so newly started sessions never collide.
UPDATE "SUPPORT_SESSION" SET case_number = nextval('support_case_seq');

ALTER TABLE "SUPPORT_SESSION"
  ALTER COLUMN case_number SET NOT NULL,
  ALTER COLUMN case_number SET DEFAULT nextval('support_case_seq'),
  ADD CONSTRAINT support_session_case_number_unique UNIQUE (case_number);

-- The staff queue reads active cases by handler.
CREATE INDEX idx_support_session_assigned
  ON "SUPPORT_SESSION"(assigned_to)
  WHERE status = 'active';
