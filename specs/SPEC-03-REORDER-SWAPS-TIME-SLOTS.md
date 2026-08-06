# SPEC-03 — Reordering swaps time sessions

## Scope

When a module is moved one position, it trades time sessions with the module it
displaced. The schedule belongs to the slot, not the module, so a whole-slot
exchange can never create an overlap — reordering stays safe by construction.

## Background

`moveModule` is used for single-step up/down moves, which are exactly a swap
with one neighbour. If the schedule stayed with the module, a move could mix
order and times inconsistently; exchanging the whole slot keeps "the Nth module
runs from the Nth window" invariant intact.

## Changes

`src/modules/courses/lib/reorder.ts` — `moveModule`:

- After the splice/insert, exchange `start_time`/`end_time` between the moved
  module and the one that slid into its old position.
- The module objects are copied before the swap so the caller's array is never
  mutated.
- `speaker_profile_id` is a property of the module content and stays with the
  module.

## Non-goals

- `describeModuleMove` and `moveLesson` are unchanged.
- No change to what reordering persists — SPEC-06 adds the schedule fields to
  the PATCH bodies.

## Files touched

- `src/modules/courses/lib/reorder.ts`

## Verification

- `test/course-reorder.test.ts`: a module moved up/down swaps times with its
  neighbour; speaker stays put; `sequence_order` renumbers as before; the input
  modules are not mutated.
