# SPEC-09 — Schedule display in event rooms

## Scope

The three room views (attendee, staff, speaker) show each module's time session
and assigned speaker as a read-only badge. This is the "during the day of the
event" surface — the reason the schedule exists.

## Background

All three rooms share the same module-rendering loop driven by `useRoomAccess`,
which fetches the course from `/api/courses/event/[eventId]`. The course embed
already carries the module's schedule columns after SPEC-04, so the rooms only
need to render them.

## Changes

- `src/modules/courses/components/module-schedule-badge.tsx` (new) — renders
  `9:00 AM – 10:00 AM · Name` via `formatTime`, or nothing when no session is
  set.
- `src/modules/events/lib/use-room-access.ts` — local `Module` interface gains
  `start_time`, `end_time`, `speaker_profile_id`, `SPEAKER_PROFILE`.
- The three room pages render the badge in each content module header and above
  each Q&A panel:
  - `src/app/events/[id]/room/page.tsx`
  - `src/app/staff/events/[id]/room/page.tsx`
  - `src/app/speaker/event/[eventId]/room/page.tsx`

## Non-goals

- No auto-highlighting of the "current" module; live highlighting already exists
  as a separate lesson-level feature.
- No editing in the room.

## Files touched

- `src/modules/courses/components/module-schedule-badge.tsx` (new)
- `src/modules/events/lib/use-room-access.ts`
- 3 room page files

## Verification

- Typecheck passes; the badge renders for scheduled modules and nothing for
  unscheduled ones.
