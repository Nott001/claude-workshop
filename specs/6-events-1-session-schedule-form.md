# Spec Events-1 — session schedule form (events domain)

> **Run order:** sixth.
> Full sequence: room-0 → data-0 → curriculum-0 → room-1 → events-0 → **events-1** → events-2 → events-3 →
> curriculum-1.

## Goal

Extend the event create/edit form — the orchestrator's authoring surface — with the session config from
events-0: a registration window and an editable in-day schedule timeline (curriculum block, breaks, and
`other` entries). The schedule editor reuses the time-option helper moved to shared in curriculum-0
(`buildTimeOptions`) and follows the `SessionTimePicker` pattern. Create and edit share the same form.

## Scope

- `events/lib/event-form-schema.ts` (`EventFormValues`, `toFormValues`, `toEventPayload`).
- `events/components/event-form-fields.tsx`: new "Session" section.
- `events/components/event-form.tsx`: client validation wiring.
- New pure helper `events/lib/session-schedule.ts` + tests.

## Implementation

### 1. `event-form-schema.ts`

`EventFormValues` += `registration_open_at: string` ("" = unset), `registration_close_at: string` (""),
`event_schedule: EventScheduleDraft[]` (`{ kind, label, start_time, end_time }`; `id` omitted).

- `toFormValues(event)`: TIMESTAMPTZ → local `datetime-local` strings; `event_schedule` passed through
  (drop `id`/`sequence_order`).
- `toEventPayload(values)`: open/close "" → null (pair-rule enforced client-side too); schedule drafts
  normalized + validated.

### 2. `event-form-fields.tsx` — "Session" section

- **Registration window**: two `datetime-local` inputs (open / close), empty = unset; inline error when
  only one is set or `open >= close`.
- **Schedule editor**: one row per entry with a kind `<select>` (`curriculum` / `break` / `other`), a
  label input shown only for `other`, start/end time `<select>`s built from
  `buildTimeOptions(eventStart, eventEnd)` (shared), plus add / remove / move-up / move-down controls.
- Client guards (mirroring events-0 zod): at most one `curriculum`; each entry within the event day; no
  overlap; `end > start` per row.

### 3. Shared helper

`buildTimeOptions` / `isOffGrid` already live in `src/shared/lib/schedule-options.ts` (curriculum-0).
Entry-overlap and intra-day validation is a **pure helper in `events/lib/session-schedule.ts`** — events
does not import curriculum (events stays independent).

### 4. Create + edit flows

- Edit: `EventForm` → `toEventPayload` → PATCH `/api/events/[id]` (window) **and** PATCH
  `/api/events/[id]/schedule` (entries). Two calls, sequential.
- Create: POST `/api/events` carries the event **and the registration window in one call** (the window
  pair is part of `eventSchema`); the returned event id then gets the schedule via
  `/api/events/[id]/schedule` PATCH. Same fields, same validation, mirrored server-side by the events-0
  zod.

## Tests

- `toFormValues` / `toEventPayload` round-trips: window pair, "" → null, schedule draft normalization.
- Pure schedule validation: overlap, intra-day, kind cardinality, label rule (call the real helper).
- Form render: fields present; inline errors appear for a half-set window and overlapping entries.

## Definition of done

- An admin can set the window + schedule on create and edit; both flows are identical.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

Schema/API (events-0), public schedule/registration surfaces (events-2), room surfacing (events-3),
builder schedule bounds (curriculum-1).
