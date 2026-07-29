-- The SUPPORT_SESSION SELECT policy at line 475 uses hardcoded role literals.
-- It previously checked for facilitator/speaker only; admin/super_admin also need access.

DROP POLICY IF EXISTS "Users see own support sessions" ON "SUPPORT_SESSION";

CREATE POLICY "Users see own support sessions"
ON "SUPPORT_SESSION" FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND u.id = user_id
  )
  OR
  EXISTS (
    SELECT 1 FROM "USER" u
    WHERE u.auth_user_id = auth.uid() AND u.role IN ('facilitator', 'speaker', 'admin', 'super_admin')
  )
);
