# Spec Events-0 — session schedule schema & API (events domain)

> **Run order:** fifth — the events specs run as a block after room-1.
> Full sequence: room-0 → data-0 → curriculum-0 → room-1 → **events-0 → events-1 → events-2 → events-3** →
> curriculum-1.

## Goal

Give admins (the orchestrators) event-level session configuration **outside the curriculum**: a
registration window and an in-day orchestration timeline of typed entries — one `curriculum` block (the
live window), `break` periods, and `other` scheduled services. Breaks and "time for other events outside
the curriculum" are only _examples_; the model is generic, so a future entry type is data, not schema.

Confirmed decisions:

- **Registration window** = a `TIMESTAMPTZ` pair on EVENT (it can precede the event day). **Unset =
  current behavior**: registration opens when the event is published and closes at the event's end.
- **In-day structure** = a real `EVENT_SCHEDULE` table (migration `00023`) with `kind` rows and a
  `curriculum`-entry cap — not JSONB. A new table means **new grants + RLS per role** for the embedded
  selects the public surfaces use (the AGENTS.md `42501` pitfall): an anon/client select that embeds
  `EVENT_SCHEDULE` fails the whole query unless the grant exists.
- **At most one `curriculum` entry per event** (user decision) — enforced at the API, same pattern as the
  module-overlap checks.
- Room behavior driven by the schedule lands in events-3; this spec is schema + API + registration gating.

## Scope

- Migration `00023` (additive only: new table + two EVENT columns).
- `shared/types.ts` Event fields, zod schemas, DAO (update whitelist + schedule replace), PATCH/GET API.
- Registration gating in `event-registration.ts` + the register route + register GET state.
- `GET /api/events/[id]/schedule` payload.
- No UI (events-1/2/3).

## Implementation

### 1. Migration `supabase/migrations/00023_event_session_schedule.sql`

```sql
ALTER TABLE "EVENT"
  ADD COLUMN registration_open_at TIMESTAMPTZ,
  ADD COLUMN registration_close_at TIMESTAMPTZ;

ALTER TABLE "EVENT" ADD CONSTRAINT chk_event_registration_window
  CHECK (
    (registration_open_at IS NULL AND registration_close_at IS NULL)
    OR (registration_open_at IS NOT NULL AND registration_close_at IS NOT NULL
        AND registration_open_at < registration_close_at)
  );

CREATE TABLE "EVENT_SCHEDULE" (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id INT NOT NULL REFERENCES "EVENT"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('curriculum', 'break', 'other')),
  label VARCHAR,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_schedule_time CHECK (end_time > start_time)
);

CREATE INDEX idx_event_schedule_event_order ON "EVENT_SCHEDULE" (event_id, sequence_order);

GRANT ALL ON "EVENT_SCHEDULE" TO service_role;
GRANT SELECT ON "EVENT_SCHEDULE" TO anon;
GRANT SELECT ON "EVENT_SCHEDULE" TO authenticated;

ALTER TABLE "EVENT_SCHEDULE" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event schedule visible when event published" ON "EVENT_SCHEDULE"
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM "EVENT" e WHERE e.id = event_id AND e.status IN ('active', 'complete')));
```

Grant/RLS rationale (the `42501` rule in AGENTS.md): every client-side select that embeds
`EVENT_SCHEDULE` — the schedule card and the register GET state read via the anon/authenticated role —
must have the `SELECT` grant, or the _whole_ embed fails and returns no rows. `service_role` (all server
routes) bypasses RLS; the published-only policy is a safety net for direct client reads. Verify with the
`migration-grants` test that the anon/authenticated grants land.

### 2. Types (`src/shared/types.ts`)

`Event` += `registration_open_at: string | null`, `registration_close_at: string | null`,
`event_schedule: EventScheduleEntry[]` (sorted by `sequence_order`; empty array when unset).

```ts
type EventScheduleKind = "curriculum" | "break" | "other";

interface EventScheduleEntry {
  id: number;
  kind: EventScheduleKind;
  label: string | null; // required when kind === "other"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM", > start_time
}
```

### 3. Zod (`events/lib/schemas.ts`)

- `eventScheduleEntrySchema`: `kind` enum; `label` required (1–80 chars) when `other`, else optional null;
  `start_time`/`end_time` `HH:MM` regex; `end_time > start_time`.
- `eventScheduleSchema` (array): at most one `curriculum`; each entry falls inside
  `[event_date + start_time, event_date + end_time]`; no overlap between entries (half-open); array order
  = timeline order (`sequence_order`).
- Registration pair: optional `registration_open_at`/`registration_close_at` with a both-or-neither
  `superRefine`.
- Wire into `eventSchema` / `eventPartialSchema` where the update route validates.

### 4. DAO

- `event.dao.updateField` whitelist += `registration_open_at`, `registration_close_at`.
- New `replaceEventSchedule(eventId, entries)`: delete all rows for the event, insert in array order
  (mirrors the `replaceEventAssignments` pattern). `EventScheduleEntry` input omits `id` (assigned by
  identity).
- `UpdateEventInput` type extended with the window fields.

### 5. API

- `PATCH /api/events/[id]/schedule`: admin (existing `loadEventOr403("edit")`); validate the full array
  with `eventScheduleSchema`; `replaceEventSchedule`; return the saved entries. Additive route — the
  existing public GET stays.
- `PATCH /api/events/[id]`: admin; parse + validate the new window fields; persist; `event.updated`
  audit unchanged.
- `GET /api/events/[id]` and the register GET state return the new fields (staff and attendees).
- `GET /api/events/[id]/schedule` (public, published-only): payload becomes `{ modules, schedule }`;
  schedule + registration times are returned only for published events (mirrors the current modules
  behavior).

### 6. Registration gating (`events/lib/event-registration.ts`)

In `ensureRegistrable` / `registerForEvent`, before the existing checks, when the window is set:

- `now < open` → 400 `"Registration opens on {formatted open}"`.
- `now >= close` → 400 `"Registration is closed."` (this can fire before the event-ended check when it
  closes earlier).

Unset window = current behavior (publish → event end), per the confirmed decision.

## Tests

- `migration-replay` / `migration-grants`: `00023` applies cleanly; the anon/authenticated `EVENT_SCHEDULE`
  grants exist (this is the embedded-select pitfall — assert them).
- Schedule zod validation: kind cardinality (≤1 curriculum), label rule, intra-day range, overlap,
  ordering; pair-rule for the window.
- Registration gating: open-future, closed-past, unset = current, window-closes-before-event-end ordering.
- DAO whitelist + `replaceEventSchedule` (replace semantics); schedule route returns only when published.

## Definition of done

- Migration `00023` additive; `EVENT_SCHEDULE` granted to anon/authenticated and RLS-published.
- PATCH schedule/event persist; GET/schedule return them; registration respects the window.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

Form UI (events-1), public schedule/registration surfaces (events-2), room surfacing (events-3).
