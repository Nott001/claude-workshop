# Spec Curriculum-1 — module schedule bounds

> **Run order:** last — depends on the EVENT_SCHEDULE shape from events-0 and the room extraction from room-1.
> Full sequence: room-0 → data-0 → curriculum-0 → room-1 → events-0 → events-1 → events-2 → events-3 →
> **curriculum-1**.

## Goal

Keep module times inside the event's orchestration timeline. Once events-0 introduces the session
schedule — one `curriculum` block plus `break`/`other` entries — a module's start/end in the builder must
(1) fall inside the curriculum block when one is set, and (2) not overlap a `break`/`other` entry. This is
enforced on the client **and** on the server, preserving the `curriculum` ⊥ `events` boundary: schedule
data flows into the curriculum builder as a prop from the caller, never by the curriculum module importing
the events module.

## Resource viewing note

Unchanged (see curriculum-0). This spec does not render resources.

## Scope

- `src/modules/curriculum/lib/scheduling.ts`: time-source + conflict model extended to treat schedule
  entries as hard constraints for module rows.
- `src/modules/curriculum/lib/curriculum-module-service.ts`: server-side module start/end validation
  against the curriculum window and non-curriculum entries.
- Builder callers in `src/modules/events` (`staff-event-detail`, `speaker-event-detail`) pass the
  schedule + window down as props.
- `src/shared/lib/schedule-options.ts` (from curriculum-0) gains the bounded/exclusion variant for the
  builder.

## Implementation

### 1. Shared time utilities (owned by curriculum-1, used by events)

Move/augment the generic pieces already extracted to `src/shared/lib/schedule-options.ts` (curriculum-0).
The current `{ eventStart, eventEnd, step, committed }` shape is adopted to a canonical
`{ start, end, exclude }`; every call site is migrated in the same spec:

- `buildTimeOptions({ start, end, exclude, step = 15, committed = [] })` → `TIME` options between
  `start` and `end`, minus the minute ranges in `exclude: { start: Time; end: Time }[]`. `step` and
  `committed` are kept from the current shape — dropping them would break the builder's
  off-grid-committed-times behavior in `module-schedule-editor.tsx` and the 15-minute grid. The builder
  passes the schedule's `break`/`other` entries as `exclude` (defaults to `[]`).
- `isExcluded(value, { start, end, exclude })` → true when `value` is outside `start..end` **or** inside
  an excluded range. `default = { start, end, exclude: [] }`. This **replaces the proposed
  `isOffGrid(value, …)` bounds check** — `isOffGrid(time, step = 15)` keeps its existing meaning (is the
  time off the grid), so the bounds/exclusion semantics get their own name instead of hijacking it.
- `findTimeOverlaps(rows, options)` → pairwise `{ first: Time; second: Time }` for rows whose
  `{ start, end }` intersects; ignores rows already hard-flagged (see below).

**Call sites migrated here:** `src/modules/courses/components/module-schedule-editor.tsx`
(`eventStart`/`eventEnd` → `start`/`end`, `committed` unchanged) — moves to curriculum in curriculum-0,
so it is edited post-move at `src/modules/curriculum/components/module-schedule-editor.tsx`; the events-1
form's `buildTimeOptions(eventStart, eventEnd)` call in `events/components/event-form-fields.tsx` →
`buildTimeOptions({ start, end })`; and `test/schedule-options.test.ts` (new param names + new
`isExcluded` cases).

The **curriculum window** passed to the builder is: the schedule's `curriculum` entry's `start_time` /
`end_time` when present, else the event's `start_time` / `end_time` (current behavior). The caller (staff
or speaker page) computes this from the event payload and passes it down as a prop.

### 2. Builder hard constraints

`src/modules/curriculum/lib/scheduling.ts` `ScheduleSource` already carries `eventStart`/`eventEnd` plus a
`default` for row `timeOptions`. Extend the row-construction model:

- New optional input: `schedule: ScheduleEntry[]` (the `EVENT_SCHEDULE` rows, minus the curriculum entry).
- A module row whose `{ start, end }` is fully outside the curriculum window, or overlaps a
  `break`/`other` entry, is marked **hard**: its select shows no conflicting options, the row renders a
  `ConflictingTimesBadge` with a message ("Outside the curriculum block", "Overlaps the break at
  {time}"), and it is excluded from soft `findTimeOverlaps` so it doesn't double-report.
- The module's own `timeOptions` come from `buildTimeOptions({ start: windowStart, end: windowEnd,
exclude: nonCurriculumEntries })`.

Only the module rows participate. Break/other entries are never editable from the builder — they belong to
the events module.

### 3. Server-side validation

`CurriculumModuleService.updateModule` takes **no event arguments today** — its overlap checks run
against sibling module rows (`findModulesByCourse`), not the event window. There is also **no service
`createModule`**: module creation goes straight through the DAO in the POST route and sets no times at
creation (times arrive later via PATCH). So server-side schedule bounds apply to **update** (the module
item PATCH). Add an optional `schedule` argument to `updateModule` (same shape as the DAO reads):

- Resolve the curriculum window from the schedule (`curriculum` entry or event window — the route
  handler passes the already-resolved window to keep the service independent of the events module).
- Reject `start < windowStart || end > windowEnd` with a typed `ModuleScheduleError("outside_curriculum_window")`.
- Reject overlap with any `break`/`other` entry: `ModuleScheduleError("overlaps_schedule_entry")`.
- Existing module-overlap and duplicate-speaker checks run unchanged; when no window/entries are
  present, module times stay unconstrained (current behavior).

The schedule reaches the service as an **argument**: the module item route handler — now at
`/api/curriculum/[curriculumId]/modules/[moduleId]` after data-0 — fetches the event + `EVENT_SCHEDULE`
by `curriculumId` (its own DAO fetch, not the room feed) and passes it in. A missing schedule means "no
constraints". No new route is introduced — the URLs are data-0's normalized ones — the handlers only
gain the fetch-and-pass. The room-1/events-3 feed select is **not** the source here: it is a
client-facing route, and the authoring path never touches it.

### 4. Builder wiring (callers in `src/modules/events`)

- `staff-event-detail.tsx` and `speaker-event-detail.tsx` already fetch the event (which now embeds
  `EVENT_SCHEDULE` after events-0) and render `CourseBuilder`. Pass `schedule={event.event_schedule}`
  and let the builder derive window + excludes. When the event has no schedule, props are `[]` and
  behavior is byte-for-byte current.

## Tests

- `scheduling` unit tests: `buildTimeOptions` exclusion ranges; `isOffGrid` boundary minutes; module row
  hard-flagged when outside window / overlapping a break; excluded from soft overlap pairs.
- `curriculum-module-service` tests: `updateModule`/`createModule` reject outside-window and
  overlapping-entry start/end; succeed when within window; unconstrained when no schedule.
- Caller tests (`staff-event-detail`/`speaker` builder integration): props flow to the builder; empty
  schedule yields current behavior.
- Coverage ratchet raised, not lowered.

## Definition of done

- A module time that falls outside the curriculum block, or across a break/other entry, is blocked in the
  UI (no conflicting option selectable) and rejected by the API with a typed error.
- No `import` from `events` anywhere under `src/modules/curriculum` (grep-verified); schedule arrives as
  props.
- Gates green; coverage not lowered.

## Out of scope

Editing the schedule from the builder (that lives in events-1/events-2). Authoring `curriculum` rows'
content (curriculum-0). Room rendering of the schedule (events-3).
