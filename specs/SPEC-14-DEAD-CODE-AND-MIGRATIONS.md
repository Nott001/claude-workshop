# SPEC-14 — Dead code removal & migration fixes

## Scope

Delete the confirmed dead code and fix the migration-set defects: undeletable user
rows, duplicate migration numbers, orphaned sequences, and the dead audit/helper
exports that SPEC-11 handed off. The migration changes are additive only
(AGENTS.md: never edit an existing migration) plus filename renumbers so replay
order is deterministic.

## Background

Dead code confirmed by repo-wide grep:

- `src/shared/components/{avatar,label,textarea,dropdown-menu}.tsx` — zero imports.
- `src/shared/db/dao/helpers.ts` — 4 of 5 exports (`findById`, `findByField`,
  `exists`, `deleteById`) unused (only `ilikePattern` has a caller).
- `src/shared/db/dao/audit.dao.ts` — `log` is a duplicate of
  `src/modules/audit/lib/log-audit-event.ts` (SPEC-11 makes the lib the single
  impl); delete the dead DAO.

Earlier drafts listed `attendees-panel.tsx` and `qr-scanner.tsx` here as never
imported. The kiosk scanner work (PR #160) ended that: `kiosk-scanner-view.tsx`
renders both — `AttendeesPanel` as the live attendee feed and `QrScanner` for the
camera/manual check-in — so neither is dead, and `subscribeToCheckins` (the
panel's realtime feed) stays in `src/shared/integrations/realtime/`.

Migration defects:

- User rows are undeletable: `PAYMENT.user_id`, `TICKET.user_id`,
  `AUDIT_LOG.actor_id`, `EMAIL_LOG.user_id`, `CHAT_MESSAGE.user_id`,
  `QA_MESSAGE.user_id` all `REFERENCES "USER"(id)` with no `ON DELETE` rule
  (RESTRICT). `DELETE /api/organization/[userId]` 500s for any user with a
  payment/audit trail.
- Duplicate numbers replay alphabetically, not numerically:
  `00009_case_management.sql` + `00009_course_event_owned.sql`, and
  `00010_allow_realtime_chat_participants.sql` + `00010_module_schedule.sql`.
- `00009_case_management.sql:10` creates `support_case_seq` with no `OWNED BY`;
  `00011` grants USAGE to `service_role` only, so the sequence floats free.

## Changes

- **Dead code deletion:** remove the four unused shared components
  (`avatar`, `label`, `textarea`, `dropdown-menu`), the unused `helpers.ts`
  exports, and — after SPEC-11 lands the lib as the single audit path —
  `audit.dao.ts`. `attendees-panel.tsx`, `qr-scanner.tsx`, and `subscribeToCheckins`
  stay (the kiosk scanner uses them). If any page renders an empty placeholder where
  a deleted component was expected, that placeholder is intentional and stays.
- **New migration** `00011_user_deletion_set_null.sql`:
  - Alter the user-owning FKs to `ON DELETE SET NULL`
    (`PAYMENT.user_id`, `TICKET.user_id`, `AUDIT_LOG.actor_id`,
    `EMAIL_LOG.user_id`, `CHAT_MESSAGE.user_id`, `QA_MESSAGE.user_id`) so
    `DELETE FROM "USER"` no longer 500s and no user data is destroyed with the
    account — the audit/order trail keeps its row, with the actor set to NULL.
  - The FKs on `PAYMENT`/`TICKET` are currently `NOT NULL`; dropping a user that
    owns one would violate that. Re-add those two constraints as nullable
    (`ALTER COLUMN ... DROP NOT NULL` + `ON DELETE SET NULL`) so the delete
    succeeds; the business layer already prevents deleting a user with live
    obligations if that is the rule, and orphaned order history is preserved.
  - `ALTER SEQUENCE support_case_seq OWNED BY <table>.<column>` — target the
    primary-key column of the support-case table so the sequence dies with its row.
- **Renumber the duplicate files** (content untouched) so each number is unique:
  - `00009_course_event_owned.sql` → `00012_course_event_owned.sql`
  - `00010_module_schedule.sql` → `00013_module_schedule.sql`
  - (`00009_case_management.sql` and `00010_allow_realtime_chat_participants.sql`
    keep their numbers; no `00011` exists yet, the new migration takes it.)
  - Files replay in numeric order after the rename; verify against the apply tool's
    ordering (alphabetical or numeric) before finalizing.

## Non-goals

- No edits to any existing migration file's contents.
- No changes to RLS policy logic (the tautological-policy history from `00006`/`00007`
  stays as history — fixing it requires schema policy edits, which is a separate
  decision).
- No new indexes or schema features beyond the FK/sequence fixes.

## Files touched

- Deleted: `src/shared/components/{avatar,label,textarea,dropdown-menu}.tsx`,
  `src/shared/db/dao/{helpers.ts,audit.dao.ts}` (partial: helpers keeps `ilikePattern`)
- `supabase/migrations/00011_user_deletion_set_null.sql` (new)
- Renames: `00009_course_event_owned.sql` → `00012_course_event_owned.sql`,
  `00010_module_schedule.sql` → `00013_module_schedule.sql`
- Tests: boundary test asserting no references to the deleted symbols; a test
  asserting the audit path is the lib (single source).

## Verification

- `rg 'attendees-panel|qr-scanner|subscribeToCheckins' src test` — references are
  only the kiosk scanner view, the attendees panel it renders, the realtime index,
  and their tests (all kept, not dead).
- `pnpm typecheck` and `pnpm test` pass.
- Migration dry-run (or a scratch DB) applies `00001`→`00013` cleanly in numeric
  order; `DELETE FROM "USER"` on a user with tickets/payments/audit rows succeeds
  and leaves the rows intact with the actor/user FK set to NULL.
- `pnpm cf:build` succeeds.
