# C-01 Staff authz restriction

First step of the staff-page redesign. **Server-first:** strip event-management
permissions from facilitators so the UI changes in C-02/C-03 do not sit on a
server that still lets them edit. Runs before any page is touched.

Facilitators are foot soldiers: they run kiosk check-in and see the event room,
but event editing (details, time, cover image) and everything to do with surveys
is admin-only. Admins are never "assigned" to events, so the assignment rules
below only ever apply to facilitators.

## Capability matrix

In `src/modules/events/lib/event-authz.ts` the `CAPABILITY_RULE` matrix is the
single source of truth for event writes. Change it so:

- `edit` — `{ minRole: ROLES.ADMIN, assignment: false }`. Assigned facilitators
  lose PATCH on the event, which is the whole "edit details / time" surface.
- `publish` — `{ minRole: ROLES.ADMIN, assignment: false }`.
- `delete` — unchanged (`ADMIN`, no assignment).
- `attendees` — **unchanged** (`FACILITATOR` + assignment). Assigned
  facilitators keep reading attendee lists and counts: that is their foot-soldier
  role, and the kiosk flow depends on the attendee read.
- Add a new capability `survey` — `{ minRole: ROLES.ADMIN, assignment: false }`,
  so survey reads and sends are admin-only as one rule.

`canManageEvent` (the same file) is used by course management and is unchanged:
assigned facilitators keep managing their event's course.

## Route guards

- `src/app/api/events/[id]/survey/route.ts` — the GET currently calls
  `loadEventOr403(..., "attendees")`, which would keep the read open to assigned
  facilitators. Switch it to the new `"survey"` capability.
- `src/app/api/events/[id]/survey/send/route.ts` — already uses `"edit"`, which
  now resolves to admin-only; no change needed beyond the matrix.
- `src/app/api/upload/event-image/route.ts` — `requireMinRole(ROLES.FACILITATOR)`
  becomes `requireMinRole(ROLES.ADMIN)`. The comment in
  `staff-event-detail.tsx` about the "facilitator floor" this enforced becomes
  wrong and is removed in C-03.
- `src/modules/events/pages/event-form.tsx` — edit mode guards with
  `useRoleGuard(ROLES.FACILITATOR)`; raise to `ROLES.ADMIN`. Create mode is
  already `ADMIN`.
- `src/modules/surveys/pages/survey-preview.tsx` — `useRoleGuard(ROLES.FACILITATOR)`
  becomes `useRoleGuard(ROLES.ADMIN)`. The preview is part of the admin survey
  surface.

`POST /api/events/[id]/publish` and `PATCH /api/events/[id]` need no route edit:
they call `loadEventOr403` with `publish` / `edit`, which the matrix now resolves
to admin-only.

## Tests

Update the behavior assertions that pinned the old matrix:

- `test/event-service.test.ts` — the matrix loop around lines 154-190: an
  **assigned** facilitator must now be refused `edit`, `publish`, and `survey`
  (403), while still passing `attendees`; add the `survey` capability to the
  admin loop. Keep the unassigned-facilitator and below-facilitator refusal
  cases.
- `test/api-events.test.ts` — the `POST /api/events/[id]/publish` block: an
  assigned facilitator is now refused (403); the admin path still publishes.
  Check the PATCH block for any facilitator-allowed case and flip it to admin.
- `test/cover-image-upload.test.tsx` (or the matching route test) — the upload
  guard is now admin.
- Any survey route test asserting a facilitator can read/send — now 403.

Add a regression test that a facilitator's PATCH on `/api/events/[id]` returns
403 even when assigned.

## Not in scope

- Any page or UI change; this spec only makes the server and the guards behave.
- The `attendees` capability: it stays with assigned facilitators (see above).
- Course-management authz (`course-access.ts`, `canManageEvent`): unchanged.

## Gate

`pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass before the
next spec is started.
