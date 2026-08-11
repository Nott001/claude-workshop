# Spec Events-2 — public surfaces: schedule & registration card (events domain)

> **Run order:** seventh.
> Full sequence: room-0 → data-0 → curriculum-0 → room-1 → events-0 → events-1 → **events-2** → events-3 →
> curriculum-1.

## Goal

Surface the session config to attendees. The public schedule card renders the `EVENT_SCHEDULE` timeline
(curriculum block, breaks, `other` entries) alongside the module rows, and the registration card + page
reflect the registration window states. `events/lib/timeline.ts` is reconciled (deleted if orphaned).

## Scope

- `events/components/event-schedule.tsx`.
- `events/components/event-register-card.tsx` + register page / `use-event-registration.ts`.
- `events/lib/timeline.ts` reconciliation.
- Consumes the events-0 `/api/events/[id]/schedule` payload; no new data fetching.

## Implementation

### 1. `event-schedule.tsx`

Use the events-0 payload `{ modules, schedule }`:

- Timeline: "Event starts" bookend → entries in order — schedule rows (`curriculum` as a
  block, `break` rows labeled "Break", `other` rows with their label) interleaved with module rows → "Event
  ends".
- **Block renders as a container**: the `curriculum` entry is one block row; module rows whose times fall
  inside the block render **nested under it** (the block is the container, the modules are the detail —
  the block may be wider than its modules). `break`/`other` rows and module rows outside the block render
  as siblings in time order. This prevents two overlapping visual entries for the same span.
- Empty → "No schedule yet."; errors → "Couldn't load the schedule." (unchanged).

The embed (`event.event_schedule`) on the public event GET and the `/schedule` payload both read the same
rows, sorted by `sequence_order`; the card can use either source — prefer the event payload where the
page already has it.

### 2. Registration surfaces

- `event-register-card.tsx`: when the window is set and not yet open → "Registration opens {date}"; when
  closed → "Registration closed"; otherwise the current CTAs (Register / Enter Room / Locked until
  start / View Ticket). Optional "opens in" countdown when opening soon.
- Register page + `use-event-registration.ts`: read open/close from the register GET state; disable the
  submit button with the matching message when outside the window (the server already enforces it —
  events-0).

### 3. `timeline.ts` reconciliation

Check the consumers of `events/lib/timeline.ts` (`buildTimeline`). The session roadmap it powered was
removed; if it is now orphaned, **delete it and its test** rather than keeping two timeline sources. If
still used, fold schedule rendering in so the schedule card is the single timeline implementation.

## Tests

- `event-schedule` renders schedule entries (curriculum/break/other) + module rows in order; empty state.
- Register card states: opens / closed / open (existing CTAs).
- Timeline reconciliation: no duplicate schedule sources.

## Definition of done

- Attendees see the full session timeline and the correct registration state.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

Room surfacing (events-3).
