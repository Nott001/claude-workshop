-- ============================================================
-- Module schedule: optional time-session and optional speaker
-- ============================================================

ALTER TABLE "MODULE"
  ADD COLUMN start_time TIME,
  ADD COLUMN end_time TIME,
  ADD COLUMN speaker_profile_id INT REFERENCES "SPEAKER_PROFILE"(id) ON DELETE SET NULL;

-- Times travel as a pair and, when set, must be ordered. Overlap between
-- modules is deliberately not constrained here; SPEC-05 enforces it at the API.
ALTER TABLE "MODULE"
  ADD CONSTRAINT chk_module_schedule
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  );
