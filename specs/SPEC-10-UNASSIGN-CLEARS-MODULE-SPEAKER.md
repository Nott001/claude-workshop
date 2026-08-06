# SPEC-10 — Unassign clears module assignments

## Scope

Removing a speaker from an event must not leave modules pointing at a speaker
who can no longer attend. The module-to-speaker reference is cleared in the same
request that unassigns them, keeping the invariant "a module's speaker is always
assigned to the event".

## Background

`MODULE.speaker_profile_id` references `SPEAKER_PROFILE`, whose row outlives the
event assignment. Unassigning deletes only the `EVENT_SPEAKER` row, so without
cleanup a module would keep a speaker who no longer has access to the event —
and the builder dropdown (fed from the event's current speakers) could no longer
represent them.

## Changes

`src/app/api/events/[id]/speakers/[profileId]/route.ts` — DELETE: after
`unassignFromEvent`, call `clearModuleSpeakerForEvent` (SPEC-04) with the event
and profile ids.

## Non-goals

- No change to the assign path.
- No builder-side reaction; the next read reflects the cleared assignment.

## Files touched

- `src/app/api/events/[id]/speakers/[profileId]/route.ts`

## Verification

- Route suite: after unassign, the clear helper is called with the event and
  profile ids.
