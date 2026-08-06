# SPEC-07 — Schedule editing in the curriculum builder

## Scope

The builder gains a schedule row per module — two time inputs and, when the
event has more than one assigned speaker, a speaker select — plus overlap
warnings. Time edits that would collide are blocked client-side before any
PATCH.

## Background

The builder is the authoring surface for speakers and staff. It never queries
the events module (the module boundary test enforces this); the host pages feed
it the event's speakers as props (SPEC-08). The builder's job is to edit and to
make an ambiguous schedule impossible to create and visible when one exists.

## Changes

`src/modules/courses/components/curriculum-builder.tsx`:

- New props `eventSpeakers: CourseSpeaker[]` and
  `onUpdateModuleSchedule(moduleId, patch) => Promise<string | null>`.
- Schedule row under every module header (content and Q&A alike): `type="time"`
  start/end inputs (empty = no session; DB `09:00:00` normalised to `09:00`),
  and a speaker `<select>` with an "Unassigned" option shown only when
  `eventSpeakers.length > 1`.
- On a time edit: run `findTimeOverlaps` over the proposed modules; if the
  edited module would overlap, revert the input and toast naming the conflict.
  Otherwise optimistic update through `onUpdateModuleSchedule`, reverting and
  toasting on error.
- A persistent warning banner when the loaded modules already overlap, plus a
  small warning icon on each conflicting module — the "fix required" sign for
  overlaps written outside the builder.

## Non-goals

- No change to lesson/Q&A behaviour, move buttons, or renaming.
- Speaker names come from props; the builder never queries the events module.

## Files touched

- `src/modules/courses/components/curriculum-builder.tsx`

## Verification

- `test/curriculum-builder.test.tsx`: time inputs render; an overlapping edit is
  blocked with a toast; a pre-existing overlap shows the banner; the speaker
  select appears only for >1 speaker and commits an assignment.
