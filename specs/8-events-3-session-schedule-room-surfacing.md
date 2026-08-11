# Spec Events-3 — session schedule drives the live room (room domain)

> **Run order:** eighth.
> Full sequence: room-0 → data-0 → curriculum-0 → room-1 → events-0 → events-1 → events-2 → **events-3** →
> curriculum-1.

## Goal

Make the room's live behavior follow the orchestrator's session schedule (confirmed decision). When a
`curriculum` entry is set, the room's live window is that entry; during a `break` the room shows a
distinct "Break" state; during an `other` entry it shows "Now: {label}". Everything lives in the room
module — the room feed already embeds the EVENT row (which now carries `event_schedule`), so **no events
import** is needed and the room ⊥ events boundary holds.

## Scope

- Pure helpers `room/lib/session-window.ts`.
- Room feed select (add the new EVENT columns).
- `room/pages/room-page.tsx` + `useRoomAccess` + hero / current-topic / navbar wiring.
- No schema, no route-guard, no validation change (events-0 zod remains the only validator).

## Implementation

### 1. Pure helpers (`room/lib/session-window.ts`)

- `sessionWindow(event): { start: string; end: string } | null` — the `curriculum` entry's times when
  present, else the event window (`event_date` + `start_time`/`end_time`); `null` when no event.
- `scheduleState(entries, eventDate, now): { kind: "curriculum" | "break" | "other" | null; label: string | null }`
  — the running entry, if any; `null` when none.

Both take the event/entry data as plain values — read-only presentation, no imports from events.

### 2. Room feed

The room-feed select for the embedded EVENT is `event.dao.findByIdWithCurriculum` (data-0's rename of
`findByIdWithCourse`, which the room route already uses at `src/app/api/room/[eventId]/route.ts`); it
gains `EVENT_SCHEDULE` in its embed (plus the registration fields if the room ever surfaces them). The
feed runs as `service_role`, so the anon/authenticated grants from events-0 are not needed here. No guard
change. Events-3 also updates `useRoomAccess` and the `fetch-room-access`/`CourseRoomCourse` payload
types to hand the room the entries it needs.

### 3. Room page wiring

- **Live window**: `useRoomAccess` derives start/end from `sessionWindow` instead of the event window
  for: hero progress (`eventProgress` called with the window), the "live" state, navbar
  elapsed/remaining + countdown, and the current-topic fallback. `findLiveModule` still uses module
  times, but a running `break` overrides "is live now".
- **Break state**: when `scheduleState` is `break` — hero badge shows "Break" (not "Live now");
  `CurrentTopicCard` is replaced by a "Break — back at {end}" banner; no module shows as current.
- **Other entry**: hero badge shows "Now: {label}"; current topic is unaffected.
- **No entries set**: today's behavior, byte-for-byte.
- **Admission is deliberately left on the event window** (explicit decision): the `not_started` gate and
  its "opens at {event start}" message keep using `event_date` + event `start_time`/`end_time`, even when
  a `curriculum` block is set. A ticket holder is admitted when the event day opens and may land in a
  "Break" state before the block starts; only live-state, hero progress, navbar, and current-topic fall
  back to `sessionWindow`.

### 4. Boundary

- `room` ⊥ `events` is preserved: `sessionWindow` / `scheduleState` live in `room/lib` and take the event
  row as data. events-0 zod stays the only validator; the room helpers are read-only.

## Tests

- `session-window`: curriculum override, fallback to event window, missing event → null.
- `schedule-state`: running break / other / curriculum, boundary times, none → null.
- Room render: break banner, "Now: {label}", progress computed over the curriculum window.
- Regression: no entries → render identical to today.

## Definition of done

- The room follows the session schedule; unset config = current behavior.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

The meaning of new entry kinds (data-driven), public surfaces (events-2).
