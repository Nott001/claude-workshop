# SPEC-03 — Assignment-aware event authorization

## Scope

Replace the role-only guards on event write endpoints with assignment-aware
authorization, and move the policy into the module as a single `event-service`
that room, pages, and API handlers all share. Tightens real holes; no URL or
middleware changes.

## Background

Today's guards check roles, not assignments:

- PATCH / DELETE / publish / attendees on `/api/events/[id]` gate on
  `requireRole("facilitator")` with no check that the caller actually manages the
  event — any facilitator can edit/delete any event.
- The highlight POST/DELETE gate on `requireRole("speaker")` with no check the
  caller is assigned to the course — any speaker can toggle any highlight. SPEC-05
  re-keys the highlight to the course, so this hole closes under the courses-module
  guard, not here.
- `canManageEvent` in `src/modules/courses/lib/course-access.ts` already implements
  the correct rule (admin+, assigned facilitator, assigned speaker) and stays in
  courses; the course-room guard consumes it (SPEC-05), so `event-service` must not
  reimplement it. The boundary allows events → courses and forbids courses → events.

## Changes

- Add `canManageEvent` (reimplemented from the courses one against `event.dao`,
  `facilitator.dao`, `speaker.dao` and the `EVENT_COURSE` link) plus a
  `loadEventOr403`-style guard helper to the `event-service` created in SPEC-02.
- Capability matrix (the single source of truth):

  | action         | admin+ | assigned facilitator | assigned speaker |
  | -------------- | ------ | -------------------- | ---------------- |
  | create         | no     | no (organizers only) | no               |
  | edit (PATCH)   | yes    | yes                  | no               |
  | delete         | yes    | no                   | no               |
  | publish        | yes    | yes                  | no               |
  | list attendees | yes    | yes                  | no               |
  | register       | yes    | yes                  | yes              |

  `highlight set` is not in this matrix: once SPEC-05 lands, the highlight is a
  course resource whose gate (admin+, assigned facilitator/speaker) lives in the
  courses module, not on an event action.

- `src/modules/courses/lib/course-access.ts` `canManageEvent` delegates to the new
  `event-service` instead of its own body (behavior identical).
- The unified course room (SPEC-05) keeps its current UX guards; the highlight gate
  is the courses-module assignment check. Event register flows keep their UX guards
  too; the server-side policy is what hardens.

## Non-goals

- No change to read endpoints (list / get / attendees-as-snapshot) or public
  registration rules.
- No change to `canCreateEvent`-style organizer gating on create — out of scope.
- No UI rework; this is server-side policy only.

## Files touched

- `src/modules/events/lib/event-service.ts` (extended in SPEC-03)
- `src/modules/courses/lib/course-access.ts` (unchanged; the course-room guard
  consumes it per SPEC-05)
- 6 app-tree handlers under `src/app/api/events/**/route.ts` (use the new guard)
- Tests: new `test/event-service.test.ts`; update role-guard tests in api-handler
  suites (facilitator-without-assignment now 403s; assigned speaker may set highlight)

## Verification

- `pnpm test` green, including the new denial cases (unassigned facilitator → 403
  on PATCH/DELETE/publish/attendees; unassigned speaker → 403 on the course
  highlight).
