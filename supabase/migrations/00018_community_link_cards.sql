-- ============================================================
-- Repurpose COMMUNITY_LINK into standalone community group cards.
--
-- The table shipped event-scoped (event_id FK, platform) in 00001 but no code
-- ever read or wrote it. A-01 turns it into the backing store for the
-- /community page: a small set of cards (StartupLab Facebook group, WhatsApp
-- groups, ...) that admins manage through /staff/community.
--
-- Existing grants (SELECT for anon and authenticated) are unchanged.
-- ============================================================

ALTER TABLE "COMMUNITY_LINK"
  DROP COLUMN event_id,
  DROP COLUMN platform;

ALTER TABLE "COMMUNITY_LINK"
  ADD COLUMN description TEXT,
  ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- RLS
--
-- Everyone reads visible cards. Staff additionally see hidden ones, so the
-- management page can list every card. The outer `"COMMUNITY_LINK".is_hidden`
-- is table-qualified because an unqualified name inside the correlated
-- subquery would bind to USER's columns (see 00008 for the bug that caused).
-- Anon has no auth.uid(), so the staff branch is naturally closed to it.
-- ============================================================
DROP POLICY IF EXISTS "Community links are public" ON "COMMUNITY_LINK";

CREATE POLICY "Community links visible unless hidden"
ON "COMMUNITY_LINK" FOR SELECT
TO anon, authenticated
USING (
  "COMMUNITY_LINK".is_hidden = false
  OR EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
  )
);
