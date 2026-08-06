# SPEC-08 — Builder host wiring

## Scope

Both pages that host the builder feed it the event's assigned speakers and the
schedule mutation. The speaker list is fetched on the events side and passed
down as props, so `src/modules/courses/**` still never imports the events
module.

## Background

The speaker course page runs as a _speaker_, but both speaker-list endpoints
(`/api/speakers`, `/api/events/[id]/speakers`) today require facilitator. The
assignment list is exactly the co-presenter roster a module assignment needs, so
the events-side GET guard drops to speaker, scoped to the events the caller is
assigned to. Staff reads are unchanged.

## Changes

- `src/shared/db/dao/speaker.dao.ts` — `listEventAssignments` embeds
  `USER (full_name)` so assignments carry names.
- `src/app/api/events/[id]/speakers/route.ts` — GET guard drops from
  `facilitator` to `speaker`; a speaker role must be assigned to the event,
  staff pass through.
- `src/modules/events/lib/use-assigned-speakers.ts` (new) — fetches
  `/api/events/[id]/speakers` and maps to `{ speaker_profile_id, full_name }`.
- `src/app/speaker/event/[eventId]/course/page.tsx` and the `CourseSection` in
  `src/app/staff/events/[id]/page.tsx` map the hook result to `CourseSpeaker[]`
  and pass `eventSpeakers` + `courseBuilder.handleUpdateModuleSchedule`.

## Non-goals

- No change to the staff speaker-management page's behaviour beyond the additive
  name embed.
- No new coupling from the courses module to events.

## Files touched

- `src/shared/db/dao/speaker.dao.ts`
- `src/app/api/events/[id]/speakers/route.ts`
- `src/modules/events/lib/use-assigned-speakers.ts` (new)
- `src/app/speaker/event/[eventId]/course/page.tsx`
- `src/app/staff/events/[id]/page.tsx`

## Verification

- An assigned speaker can load the event's speaker list; an unassigned speaker
  cannot.
- The module-boundary test still passes.
