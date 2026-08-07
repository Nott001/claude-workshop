# SPEC-04 — Event module fat-file splitting

## Scope

Split the five oversized files in `src/modules/events/` into focused, small,
single-purpose modules. Public exports keep their names and import sites; internal
shape changes only. No behavior change.

## Background

AGENTS.md requires small, single-purpose modules. These files have grown past that:

- `components/event-form.tsx` — 363 lines: form shell, field groups, validation,
  mode-switching (create vs edit).
- `lib/use-room-access.ts` — 165 lines: assignment loading, role + assignment
  authorization, redirect logic.
- `lib/use-event-detail.ts` — 139 lines: detail fetch, status derivation, timeline
  assembly.
- `components/event-card.tsx` — 114 lines: card shell + status badge + date/time
  formatting + image.
- `lib/use-event-registration.ts` — 110 lines: register mutation, attending-state,
  capacity/dates checks.

## Changes

- `components/event-form.tsx` → split off `components/event-form-fields.tsx`
  (pure field groups) and `lib/event-form-schema.ts` (create/edit validation);
  `event-form.tsx` keeps the shell + mode switching.
- `lib/use-room-access.ts` → `lib/use-room-access.ts` (loading + redirect only) +
  `lib/room-access-policy.ts` (role + assignment checks; fold into `event-service`
  consumers in SPEC-03 where it overlaps).
- `lib/use-event-detail.ts` → `lib/use-event-detail.ts` (fetch + status) +
  `lib/timeline.ts` (timeline assembly; already renamed in SPEC-00).
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

- 5 files under `src/modules/events/` rewritten; 5 new files added.
- Import sites outside the module updated only where a re-export would otherwise be
  required (none expected — consumers import the top-level names).

## Verification

- `pnpm typecheck` passes.
- `pnpm test` green — all tests import the same public names as before.
- Every file under `src/modules/events/` is under the 200-line budget.
