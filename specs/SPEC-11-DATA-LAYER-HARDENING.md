# SPEC-11 — Data-layer hardening

## Scope

Fix the DAO-layer defects: silent reads that conflate "query failed" with "no
row", unbounded list queries, an empty-array `.in()` footgun, error-swallowing
audit/email paths, and duplicated query logic. Behavior changes only where errors
are now surfaced correctly.

## Background

The DAO layer has systemic error-handling problems:

- ~10 `findById`-family reads destructure `{ data }` and never inspect `.error`,
  using `.single()` so a missing row raises PGRST116 and a failed query returns
  `null` — indistinguishable outcomes (`event.dao.ts:20-23`, `course.dao.ts:39-42`,
  `speaker.dao.ts:15-18,22-24`, `user.dao.ts:4-7,9-12`, `ticket.dao.ts:42-55`,
  `payment.dao.ts:9-12`, `email.dao.ts:9-12`, `qa-message.dao.ts:62-65`,
  `chat-message.dao.ts:4-10,101-107`). The correct `.maybeSingle()` pattern already
  exists (`support-session.dao.ts:35`, `payment.dao.ts:33-41,49-58`).
- List queries have no `.range()`/`.limit()` — every event, ticket, payment, email
  log row is fetched (`event.dao.list:41-78`, `ticket.dao.listAll/listByUser`,
  `payment.dao.listAll/listByUser`, `email.dao.list:14-44`,
  `speaker.dao.list:26-29`, `course.dao.listCoursesWithEvents:14-37`,
  `support-session.dao.listCases:176-224`).
- `event.dao.findByIds:174-180` does `.in("id", ids)` with no empty-array guard —
  an empty list returns every row (the trap `event.dao.list:58-60` documents but
  `findByIds` does not honor).
- `src/modules/audit/lib/log-audit-event.ts:12-18` awaits an insert with no error
  check — the audit trail silently drops events; it also duplicates `audit.dao.log`
  (dead). `src/modules/notifications/lib/email.ts:53-55` swallows email failures.
- Duplicate query logic: the audit insert written twice, cursor pagination
  implemented twice (`chat-message.dao.ts:37-56,192-209` vs `qa-message.dao.ts:21-40`),
  the session-filter chain built three times (`support-session.dao.ts:22-33,53-63,137-152`),
  the ticket-eligibility WHERE clause twice, and raw `%${search}%` interpolation
  in `.or()` filters (`user.dao.listStaff:32`, `chat-message.dao.ts:169,177`) that
  a `%`, `_`, or `,` corrupts.

## Changes

- **Silent reads → explicit errors.** Convert the listed `findById` reads to
  `.maybeSingle()` and return a discriminated result or throw on `.error`, so
  callers can distinguish "not found" from "query failed". Update each caller in
  the routes/services to the new shape. Leave `event.dao.isPublished`/`getUpcomingForLanding`
  error-masking (SPEC-14 decision on landing rendering) — flag, don't change, the
  landing-page empty-state behavior.
- **Pagination.** Add `.range(offset, limit)` (defaults ~50) to the unbounded
  lists: `event.dao.list`, `ticket.dao.listAll/listByUser`,
  `payment.dao.listAll/listByUser`, `email.dao.list`, `speaker.dao.list`,
  `course.dao.listCoursesWithEvents`, `support-session.dao.listCases`. Callers
  that render "all" get a bounded page; add `count` where the UI shows totals.
- **Empty-array guard.** `event.dao.findByIds` (now in the events module after
  SPEC-01) returns `[]` for an empty input before building the query.
- **Audit + email.** `log-audit-event.ts` checks the insert `.error` and surfaces
  it (log + non-throwing `false`), and `audit.dao.log` is deleted in favor of the
  lib (SPEC-14 deletes the dead file; here we point the one true impl at the lib).
  `notifications/lib/email.ts:53-55` logs the swallowed error and rethrows for
  caller-controlled handling (check-in/ticket email paths surface it).
- **Query dedup.** Extract one shared `buildMessageFeed`/cursor helper used by
  `chat-message.dao` and `qa-message.dao`; one `sessionFilter` builder for
  `support-session.dao`; one `findActiveTicketByUserAndEvent` used by both
  `ticket.dao` and `course-access` eligibility; one `orFilter` escaping helper
  (`ilikePattern`) applied to `user.dao.listStaff` and `chat-message.dao` filters.

## Non-goals

- No schema changes.
- No behavior change to "not found" handling in the UI — callers now decide.
- The client-side browser DAO queries (`chat-panel.tsx`, `qa-panel.tsx`,
  `global-support-chat.tsx`, `use-support-cases.ts`) are SPEC-13's scope, not here.

## Files touched

- DAOs: `event.dao`, `course.dao`, `speaker.dao`, `user.dao`, `ticket.dao`,
  `payment.dao`, `email.dao`, `qa-message.dao`, `chat-message.dao`,
  `support-session.dao` (post-SPEC-01 locations)
- `src/modules/audit/lib/log-audit-event.ts`, `src/modules/notifications/lib/email.ts`
- Callers of the changed DAO signatures in `src/app/api/**` and module services
- Tests: extend DAO tests with failure-path cases (`.error` surfaces, empty-array
  `findByIds`, list bounds); update callers' tests for the new result shapes.

## Verification

- `pnpm test` green, including new failure-path tests.
- `pnpm typecheck` passes.
- `pnpm cf:build` succeeds.
- Manual: list endpoints cap at the page size; a forced DB error on a read now
  reaches the caller instead of returning `null`.
