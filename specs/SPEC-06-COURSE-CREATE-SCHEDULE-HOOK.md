# SPEC-06 — Schedule edits in useCourseCreate

## Scope

The store/controller gains the mutation for schedule edits and starts persisting
schedule fields on reorder. Optimistic with revert-on-error, matching the
hook's existing pattern.

## Background

`useCourseCreate` owns every mutation the builder fires. Time and speaker edits
and reorders all land here; the builder (SPEC-07) only describes intent, the
hook persists it.

## Changes

`src/modules/courses/lib/use-course-create.ts`:

- `handleUpdateModuleSchedule(moduleId, { start_time, end_time,
speaker_profile_id })` — optimistic `setModules`, PATCH `/api/modules/:id`
  with name/sequence and the three schedule fields, revert and return the API
  error message on failure.
- `handleReorderModules` includes `start_time`, `end_time`,
  `speaker_profile_id` in each PATCH body — SPEC-03 can swap them, so the
  reorder must write them back.

## Non-goals

- No validation here; the builder (SPEC-07) blocks bad edits and the API
  (SPEC-05) is the backstop.
- No change to lesson or Q&A mutations.

## Files touched

- `src/modules/courses/lib/use-course-create.ts`

## Verification

- Hook suite: a failed PATCH restores the previous modules and returns the
  error; reorder PATCH bodies carry the schedule fields.
