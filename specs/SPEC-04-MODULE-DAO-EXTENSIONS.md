# SPEC-04 — Module DAO extensions

## Scope

The data-access surface for the feature: `updateModule` accepts schedule fields,
course reads embed the assigned speaker's name for the room (SPEC-09), and a
helper clears module speaker references when a speaker leaves an event.

## Background

All course reads that feed the builder and the rooms go through
`findCourseByEvent` / `findCourseWithDetails` on the service client. Adding the
speaker embed there is safe for grants — the service client bypasses RLS, and
the anon/authenticated read paths that AGENTS.md warns about (the landing page)
do not touch these queries.

## Changes

`src/shared/db/dao/course.dao.ts`:

- `updateModule` data type gains optional `start_time`, `end_time`,
  `speaker_profile_id`.
- `findCourseByEvent` and `findCourseWithDetails` embed
  `SPEAKER_PROFILE (id, designation, USER (full_name))` under `MODULE`.
- `clearModuleSpeakerForEvent(supabase, eventId, speakerProfileId)` — nulls
  `speaker_profile_id` on every module of the event's course(s). No-op when the
  event has no course.

`src/modules/courses/lib/types.ts`:

- `ModuleWithLessons` gains the `SPEAKER_PROFILE` embed.
- New `CourseSpeaker` input type (`{ speaker_profile_id, full_name }`) — the
  builder's prop shape (SPEC-07).

## Non-goals

- No changes to reads that return a bare `Module[]`; the overlap check in
  SPEC-05 uses `findModulesByCourse`, which keeps no embed.
- No new dependencies.

## Files touched

- `src/shared/db/dao/course.dao.ts`
- `src/modules/courses/lib/types.ts`

## Verification

- DAO suite: `updateModule` forwards the new fields; the clear helper targets
  only the event's modules and the speaker id.
