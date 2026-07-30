-- ============================================================
-- Q&A as a course module type: locked/unlockable, auto-delete
-- ============================================================

-- Add module_type and is_locked to MODULE
ALTER TABLE "MODULE"
  ADD COLUMN module_type TEXT NOT NULL DEFAULT 'lessons',
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT true;

-- Remove threading/verbal columns from QA_MESSAGE, link to module
ALTER TABLE "QA_MESSAGE"
  DROP COLUMN reply_to,
  DROP COLUMN answered_verbally,
  ADD COLUMN module_id INT NOT NULL REFERENCES "MODULE"(id) ON DELETE CASCADE;

-- Index for module-scoped queries
CREATE INDEX idx_qa_message_module ON "QA_MESSAGE"(module_id, created_at DESC);

-- Drop old event-scoped index (now redundant with module_id)
DROP INDEX IF EXISTS idx_qa_message_event;

-- ============================================================
-- Auto-delete QA messages when an event is marked 'complete'
-- ============================================================
CREATE OR REPLACE FUNCTION delete_qa_on_event_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status <> 'complete') THEN
    DELETE FROM "QA_MESSAGE"
    WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delete_qa_on_event_complete
  AFTER UPDATE OF status ON "EVENT"
  FOR EACH ROW
  WHEN (NEW.status = 'complete')
  EXECUTE FUNCTION delete_qa_on_event_complete();

-- ============================================================
-- RLS — Update QA_MESSAGE policy for module-based access
-- ============================================================
DROP POLICY IF EXISTS "Users read Q&A messages for their events" ON "QA_MESSAGE";

CREATE POLICY "Users read Q&A messages for their modules"
ON "QA_MESSAGE" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND (
      u.id = user_id
      OR
      EXISTS (
        SELECT 1 FROM "EVENT_FACILITATOR" ef
        WHERE ef.event_id = event_id AND ef.user_id = u.id
      )
      OR
      EXISTS (
        SELECT 1 FROM "SPEAKER_PROFILE" sp
        JOIN "EVENT_SPEAKER" es ON es.speaker_profile_id = sp.id
        WHERE es.event_id = event_id AND sp.user_id = u.id
      )
      OR
      EXISTS (
        SELECT 1 FROM "TICKET" t
        WHERE t.event_id = event_id AND t.user_id = u.id
      )
    )
  )
);

-- ============================================================
-- Realtime — ensure MODULE updates (is_locked) are published
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE "MODULE";
