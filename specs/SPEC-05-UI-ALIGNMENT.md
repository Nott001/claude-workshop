# SPEC-05 — UI Alignment

Prerequisites: SPEC-04
After this: SPEC-06

## Scope

Two page changes. Remove the now-dead "Created By" column from the admin
courses table, and stop showing a "Create Course" button to staff who would
hit a 403 under the SPEC-02 policy (the dead-button case: an unassigned
facilitator visiting the staff event page). The speaker course page is already
assignment-gated and is not touched.

## Background

SPEC-02 dropped `creator_name` from the DAO, so `staff/courses/page.tsx` reads
a field that no longer exists. Separately, `CourseSection` on the staff event
page shows the "Create Course" button to any speaker-role visitor; under the
new policy a facilitator who is not assigned to that event (but who passes the
page-level `useRoleGuard("facilitator")`) sees a button that always 403s. The
page knows enough to decide up front: the event detail payload already embeds
`EVENT_FACILITATOR(user_id)` (see `event.dao.ts findByIdWithCourse`), and
`useEventDetail` already computes `isSpeakerAssigned`.

## Changes

### 1. `src/app/staff/courses/page.tsx`

- Drop `creator_name` from the `CourseRow` interface.
- Remove the "Created By" `<th>` and the matching `<td>`.
- Everything else in the audit table is unchanged.

### 2. `src/app/staff/events/[id]/page.tsx`

Add one derived boolean in `StaffEventDashboardPage` and pass it down:

```ts
const isAdmin = hasMinRole(userRole, "admin");
const isAssignedFacilitator = event.EVENT_FACILITATOR?.some((f) => f.user_id === user?.id) ?? false;
const canManageCourse = isAdmin || isAssignedFacilitator || isSpeakerAssigned;
```

- `isSpeakerAssigned` and `event` come from `useEventDetail`; `user` from
  `useSession`.
- `CourseSection` gains a `canManageCourse: boolean` prop and replaces its
  internal `isSpeaker` gating on the two authoring branches:
  - "No course yet" state renders the "Create Course" button only when
    `canManageCourse`; otherwise it shows the read-only "Waiting for the
    speaker to create a course" message (the existing fallback).
  - "Course exists with modules" state renders `CurriculumBuilder` +
    `LessonDialog` only when `canManageCourse`; otherwise show the compact
    read-only course summary (module/lesson counts) that already exists above
    it.
- `CourseSection`'s `userRole` prop is no longer needed for authoring gating;
  keep it if the admin "Assign a speaker first" branch still uses it.

The event detail `GET /api/events/[eventId]` already includes
`EVENT_FACILITATOR`, so no API change is required for this page to know the
assignments.

## Files touched

- `src/app/staff/courses/page.tsx`
- `src/app/staff/events/[id]/page.tsx`

## Verification

- No reference to `creator_name` remains in `src/app/`.
- Sign in as a facilitator not assigned to an event → staff event page shows
  the read-only course summary, no "Create Course" affordance.
- Sign in as an admin → full authoring UI, as before.
- Sign in as an assigned speaker on the speaker course page → authoring UI
  unchanged.
- `pnpm typecheck`, `pnpm test` pass.
