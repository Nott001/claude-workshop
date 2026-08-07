# SPEC-06 — Event page consolidation

## Scope

Collapse the event page trees onto `pages/` components consumed by the three app
trees, remove the dead/odd event pages, and deduplicate the ~40-line course-builder
wiring shared by the staff dashboard and the speaker course page.

## Background

With the room unified (SPEC-05), the remaining event pages are still written three
ways across `/events`, `/staff/events`, and `/speaker/event`. Meanwhile three
`src/app/events/[id]/` pages are dead weight: `speakers/page.tsx` and
`support/page.tsx` are redirect stubs, and `edit/page.tsx` is an ungated page whose
PATCH always 403s for attendees. And `courses/components/CourseSection`
(staff dashboard) and `src/app/speaker/event/[eventId]/course/page.tsx` hand-roll
the same ~40 lines of course-builder wiring.

## Changes

- Move each remaining event page's body into `src/modules/events/pages/` and leave
  the app-tree `page.tsx` files as thin shells that render the module component (or
  re-export it, keeping any `metadata`/`generateMetadata`/segment-config local to
  the app tree):
  - `pages/event-list.tsx` (attendee listing) — replaces `src/app/events/page.tsx` body
  - `pages/event-detail.tsx` — replaces `src/app/events/[id]/page.tsx` body
  - `pages/event-form.tsx` — replaces `src/app/events/[id]/edit/page.tsx` +
    `src/app/staff/events/[id]/edit/page.tsx` + `src/app/staff/events/new/page.tsx`
    (create/edit from SPEC-04's split form)
  - `pages/staff-event-list.tsx`, `pages/staff-event-detail.tsx`,
    `pages/speaker-event-list.tsx`, `pages/speaker-event-detail.tsx` — move the
    staff and speaker tree bodies wholesale
- Delete `src/app/events/[id]/speakers/page.tsx`, `src/app/events/[id]/support/page.tsx`
  (dead redirect stubs).
- Convert `src/app/events/[id]/edit/page.tsx` to redirect authenticated
  staff/facilitators to `/staff/events/[id]/edit` and everyone else to `/events/[id]`
  (or delete it outright — see Verification for the chosen option).
- New `src/modules/courses/components/course-builder-section.tsx` extracting the
  shared ~40-line wiring; both the staff dashboard `CourseSection` and the speaker
  course page render it.

## Non-goals

- No URL restructuring.
- No new auth surface beyond what `event-service` (SPEC-03) already provides.
- Kiosk/check-in remains out of scope.

## Files touched

- `src/modules/events/pages/*` (7 new files)
- ~7 app-tree `page.tsx` files rewritten as thin shells; 2 deleted; `edit` page
  redirected/deleted
- `src/modules/courses/components/course-builder-section.tsx` (new)
- Staff dashboard `CourseSection` + speaker course page (use the new component)
- Tests: page-render tests updated for the moved components; edit-page redirect test

## Verification

- `pnpm test`, `pnpm typecheck`, `pnpm lint` green.
- `pnpm cf:build` succeeds with the page shells.
- `rg "src/app/events|src/app/staff/events|src/app/speaker/event" test` — tests now
  exercise `pages/` components, not the app-tree bodies.
