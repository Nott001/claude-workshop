# Spec 001 — Shared event progress helper

## Goal

Extract the overall-event progress calculation out of the events module so the
new session hero (Spec 002) and the existing `SessionTimeline` share one source
of truth. This is a root-cause refactor: the formula currently lives only inside
`session-timeline.tsx` and the hero needs the same number.

## Scope

- New pure helper in `src/shared/lib/`.
- `SessionTimeline` refactored to consume it.
- No behavior change. No UI change.

## Implementation

### 1. New file: `src/shared/lib/event-progress.ts`

Move the `overallProgress` function verbatim from
`src/modules/events/components/session-timeline.tsx:17-31` into this file and
export it as `eventProgress`:

```ts
export function eventProgress(
  eventDate: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date,
): number;
```

Behavior (unchanged from today):

- Returns `0` when either time is missing/invalid, or `now < start`.
- Returns `1` when `now >= end`.
- Returns the linear fraction `(now - start) / (end - start)` otherwise.

Uses `parseLocalDateTime` from `@/shared/lib/date-utils`.

### 2. Refactor `src/modules/events/components/session-timeline.tsx`

- Delete the local `overallProgress` function.
- Import `eventProgress` from `@/shared/lib/event-progress`.
- Replace the `overallProgress(...)` call site with `eventProgress(...)`.
- Keep the component's props and JSX identical.

## Tests

Add `test/event-progress.test.ts` (vitest, `describe`/`it`/`expect`). Assert on
behavior with real `Date` values and a fixed local date string (e.g. `2026-08-11`):

- `0` before the start time.
- `1` at/after the end time.
- proportional values between start and end (e.g. exactly 50% at midpoint).
- `0` when `startTime` or `endTime` is null/undefined/garbage.
- `0` when end is before or equal to start.

Keep existing `test/timeline.test.ts` passing — it must not need edits.

## Definition of done

- `eventProgress` exported from `src/shared/lib/event-progress.ts`.
- `SessionTimeline` imports it; no `overallProgress` remains anywhere.
- `pnpm test` green; coverage thresholds in `vitest.config.ts` not lowered.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean.

## Out of scope

Any UI work, the hero itself (Spec 002), and anything in the courses module.
