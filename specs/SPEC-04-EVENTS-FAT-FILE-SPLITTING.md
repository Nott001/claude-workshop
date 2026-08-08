# SPEC-04 — Event module fat-file splitting

## Scope

Split the five oversized files in `src/modules/events/` into focused, small,
single-purpose modules. Public exports keep their names and import sites; internal
shape changes only. No behavior change.

## Background

AGENTS.md requires small, single-purpose modules. Three files have grown past that
(the other two from the original audit were already split — see Changes):

- `components/event-form.tsx` — 363 lines: form shell, field groups, validation,
  mode-switching (create vs edit).
- `components/event-card.tsx` — 114 lines: card shell + status badge + date/time
  formatting + image.
- `lib/use-event-registration.ts` — 110 lines: register mutation, attending-state,
  capacity/dates checks.

## Changes

- `components/event-form.tsx` → split off `components/event-form-fields.tsx`
  (pure field groups) and `lib/event-form-schema.ts` (create/edit validation);
  `event-form.tsx` keeps the shell + mode switching.
- `lib/use-room-access.ts` — split already done: `lib/room-access-policy.ts`
  (`canAccessRoom`) exists and is imported, so nothing to extract here. The
  live-module/`assignedSpeakerCount` wiring it gained is SPEC-05/SPEC-12 territory.
- `lib/use-event-detail.ts` — no split: the fetch + status derivation stays put, and
  there is no timeline assembly to extract (`lib/timeline.ts` is SPEC-00's renamed
  roadmap builder — a different thing, the event-detail page does not build one).
- `components/event-card.tsx` → `components/event-card.tsx` + `components/event-status-badge.tsx`.
- `lib/use-event-registration.ts` → `lib/use-event-registration.ts` (mutation +
  state) + `lib/event-registration-policy.ts` (capacity/dates checks).

## Non-goals

- No unification of the overlapping hook families
  (`use-event-detail`/`use-speaker-event`,
  `use-event-list`/`use-speaker-events`/`use-upcoming-events`) — their public
  surface stays as-is per the approved plan.
- No auth behavior change.

## Files touched

- 3 files under `src/modules/events/` rewritten; 4 new files added
  (`event-form-fields.tsx`, `event-form-schema.ts`, `event-status-badge.tsx`,
  `event-registration-policy.ts`).
- Import sites outside the module updated only where a re-export would otherwise be
  required (none expected — consumers import the top-level names).

## Verification

- `pnpm typecheck` passes.
- `pnpm test` green — all tests import the same public names as before.
- Every file under `src/modules/events/` is under the 200-line budget.
