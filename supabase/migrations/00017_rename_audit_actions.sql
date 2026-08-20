-- The staff page that managed the "organization" now manages users, so the
-- audit trail reads the same way. Renaming the values in place rewrites what
-- existing rows store; there is no old value left in the column afterwards.
ALTER TYPE "public"."audit_action" RENAME VALUE 'organization.invited' TO 'user.invited';
ALTER TYPE "public"."audit_action" RENAME VALUE 'organization.role_changed' TO 'user.role_changed';
ALTER TYPE "public"."audit_action" RENAME VALUE 'organization.removed' TO 'user.removed';
-- The admin delete flow records a full account teardown under this action.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'user.deleted';