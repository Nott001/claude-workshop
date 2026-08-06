# SPEC-05 — Module PATCH scheduling API

## Scope

`PATCH /api/modules/[id]` accepts schedule edits and enforces the two
invariants: a module may not gain a time session that overlaps another module,
and a module may only be assigned a speaker assigned to the event. Rejections
name the conflict so the builder can say exactly what is wrong.

## Background

The route already guards on the caller's role and course access and parses with
`moduleSchema`. Schedule fields ride that same schema. The overlap check must
not lock a course out of further edits: a pre-existing overlap between two
untouched modules is a data problem to surface (SPEC-07), not a reason to refuse
an unrelated edit.

## Changes

`src/app/api/modules/[id]/route.ts` — PATCH, existing `moduleSchema` branch:

- If `speaker_profile_id` is present: when non-null, resolve the module's course
  to its event and verify `speakerDao.checkSpeakerAssignment`; otherwise 400
  "Speaker is not assigned to this event". `null` clears without a check.
- If either time is present: merge the proposed times onto the module, load the
  course's other modules via `findModulesByCourse`, run `findTimeOverlaps`, and
  400 only when the _edited_ module is part of an overlap — naming the other
  module.
- Pass the fields through `courseDao.updateModule`.

## Non-goals

- No new endpoint; schedule edits are PATCHes like renames.
- No database constraint (see SPEC-00).
- The `is_locked` branch is untouched.

## Files touched

- `src/app/api/modules/[id]/route.ts`

## Verification

- `test/api-module-schedule-patch.test.ts`: a colliding window is rejected
  naming the other module; an unassigned speaker is rejected; a clean edit and
  `null` clears succeed; an unrelated pre-existing overlap still permits the
  edit.
