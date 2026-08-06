# SPEC-02 — Time-overlap detection

## Scope

A single pure function that, given modules with optional time sessions, returns
every pair whose sessions overlap. The builder (SPEC-07) and the module PATCH
route (SPEC-05) must agree on what "overlap" means, so it lives in one place
both can import.

## Background

The event day is modelled as TIME columns. A module session is half-open
`[start, end)`: "9:00–10:00" followed by "10:00–12:00" is a valid schedule, and
a module that starts inside another module's window is not. Both the client and
the server need this judgement, and a shared pure helper keeps them from
drifting apart.

## Changes

`src/modules/courses/lib/scheduling.ts` (new):

- `findTimeOverlaps<T extends ScheduleSource>(modules: T[]): [T, T][]` where
  `ScheduleSource` is `{ module_name: string; start_time: string | null;
end_time: string | null }`.
- Half-open `[start, end)` semantics: `a` and `b` overlap iff
  `startOf(a) < endOf(b) && startOf(b) < endOf(a)`.
- Compares minute values, not strings.
- Skips modules missing either time.

## Non-goals

- No knowledge of courses or persistence.
- No awareness of the edited module — callers decide whether an edit caused an
  overlap (SPEC-05, SPEC-07).

## Files touched

- `src/modules/courses/lib/scheduling.ts` (new)

## Verification

- `test/course-scheduling.test.ts`: adjacent windows pass, partial and
  contained overlaps are detected, missing times are skipped, and multiple
  pairs surface together.
