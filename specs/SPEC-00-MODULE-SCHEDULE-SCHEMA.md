# SPEC-00 — Module schedule columns

## Scope

Add the physical storage for a module's optional time-session and optional
speaker: three nullable columns on `MODULE`, and the shared `Module` type fields
that mirror them. Nothing here changes behaviour — it is the substrate
SPEC-01 onward build on.

## Background

The `EVENT` row already spans a single day as `start_time`/`end_time` TIME
columns. A course module can now be scheduled into a window of the event day
(e.g. "9:00–10:00"), and when an event has more than one assigned speaker a
module can be claimed by one of them. All of it is optional: a module without a
session or speaker behaves exactly as a module today.

## Changes

Migration `supabase/migrations/00010_module_schedule.sql`:

- `start_time TIME` — nullable.
- `end_time TIME` — nullable.
- `speaker_profile_id INT REFERENCES "SPEAKER_PROFILE"(id) ON DELETE SET NULL`.
- CHECK `chk_module_schedule`: both times present together, and when present
  `end_time > start_time`. Overlap _between_ modules is intentionally not
  constrained here — SPEC-05 enforces that at the API, per the product decision
  to keep the database layer simple.

`src/shared/types.ts` — `Module` gains `start_time: string | null`,
`end_time: string | null`, `speaker_profile_id: number | null`.

## Non-goals

- No overlap constraint in the database.
- No API or UI changes.

## Files touched

- `supabase/migrations/00010_module_schedule.sql` (new)
- `src/shared/types.ts`

## Verification

- `pnpm typecheck` passes — module fixtures now carry the three null fields.
- Migration replays cleanly.
