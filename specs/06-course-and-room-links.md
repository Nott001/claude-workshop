# 06. Update the course builder and course-room exit links

## Goal

Fix the two remaining production navigations that still point at the old
singular `/speaker/event/{id}` shape: the speaker course-builder page's
redirect-and-breadcrumb, and the shared course-room page's speaker exit target.

## Run order

Sixth. Depends on sheet `01` moving the course page into
`src/app/speaker/events/[eventId]/course/page.tsx`.

## Files touched

- `src/app/speaker/events/[eventId]/course/page.tsx` (moved in sheet `01`)
- `src/app/courses/[courseId]/room/page.tsx`

## Prerequisites

- Sheet `01` complete.

## Steps

1. In `src/app/speaker/events/[eventId]/course/page.tsx`, update the
   "not assigned" redirect (line 37):

   ```diff
   -      router.replace(`/speaker/event/${eventId}?error=not_assigned`);
   +      router.replace(`/speaker/events/${eventId}?error=not_assigned`);
   ```

2. Same file, the breadcrumb back link (line 59):

   ```diff
   -          href={`/speaker/event/${eventId}`}
   +          href={`/speaker/events/${eventId}`}
   ```

3. In `src/app/courses/[courseId]/room/page.tsx`, the speaker exit in
   `handleExit` (line 64) — only the speaker branch, the staff and attendee
   branches stay:

   ```diff
   -      router.push(`/speaker/event/${eventId}`);
   +      router.push(`/speaker/events/${eventId}`);
   ```

## Verification

- `grep -rn "speaker/event" src/` returns nothing (the singular form is gone
  everywhere).

  Except: the staff detail page at `src/modules/events/pages/staff-event-detail.tsx`
  must still contain `/staff/events` — confirm the sweep only removed `speaker/event`.

## Risks / notes

- The course-builder page lives under `[eventId]/course` — a relative parent
  link could be rewritten to `../`, but the codebase consistently uses absolute
  paths; keep that convention and edit the literal.
- `handleExit` branches on `userRole`/`isStaff` — change **only** the speaker
  branch; the attendee `/events/{id}` and staff `/staff/events/{id}` targets
  are correct today.
