# SPEC-04 — Event module fat-file splitting

## Scope

Split the five oversized files in `src/modules/events/` into focused, small,
single-purpose modules. Public exports keep their names and import sites; internal
shape changes only. No behavior change.

## Background

AGENTS.md requires small, single-purpose modules. Four files have grown past that
(the other two from the original audit were already split — see Changes):

- `components/event-form.tsx` — 363 lines: form shell, field groups, and the
  form's data model (`EventFormValues` + the `toFormValues`/`toEventPayload`
  conversions). The create vs edit modes are the pages' job, not the form's:
  `/staff/events/new` submits a POST and `EditEventForm` a PATCH.
- `components/event-card.tsx` — 114 lines: card shell + status badge + date/time
  formatting + image.
- `lib/use-event-registration.ts` — 110 lines: register mutation + state + the
  payment-flow decision (there are no capacity/dates checks today — nothing
  client-side enforces them, so that part of the plan is superseded).
- `lib/event-service.ts` — 506 lines: grew past the budget as SPEC-02/03 landed;
  not part of the original audit but split here so the 200-line gate holds.

## Changes

- `components/event-form.tsx` → split off `components/event-form-fields.tsx`
  (pure field groups) and `lib/event-form-schema.ts` (the form data model —
  `EventFormValues`, `EMPTY_EVENT_FORM`, `toFormValues`, `toEventPayload`,
  `EventPayload`); `event-form.tsx` keeps the shell, roster loading and
  submission, and re-exports the moved names so consumers are untouched.
- `lib/use-room-access.ts` — split already done: `lib/room-access-policy.ts`
  (`canAccessRoom`) exists and is imported, so nothing to extract here. SPEC-05
  renames it to `use-course-room-access` and moves it into
  `src/modules/courses/lib/` — it is no longer an events-module file, and the
  live-module/`assignedSpeakerCount` wiring follows it there.
- `lib/use-event-detail.ts` — no split: the fetch + status derivation stays put, and
  there is no timeline assembly to extract (`lib/timeline.ts` is SPEC-00's renamed
  roadmap builder — a different thing, the event-detail page does not build one).
- `components/event-card.tsx` → `components/event-card.tsx` + `components/event-status-badge.tsx`
  (the card's Live/status pill as `EventStatusBadge`).
- `lib/use-event-registration.ts` → `lib/use-event-registration.ts` (mutation +
  state + I/O) + `lib/event-registration-policy.ts` (`paymentDestination` — the
  pure decision of where a registration goes next from the payment-init
  response). The two payment branches collapse into one request with the
  decision handed to the policy.
- `lib/event-service.ts` → a re-exporting facade over `lib/event-errors.ts`,
  `lib/event-authz.ts` (guard + capability matrix), `lib/event-crud.ts`,
  `lib/event-delete.ts`, `lib/event-registration.ts`, `lib/event-attendees.ts`
  and `lib/event-highlight.ts`. Public names and import sites unchanged.
- `lib/event-delete.ts` and `lib/event-highlight.ts` no longer touch supabase
  inline — `events/lib` interfaces with DAOs only. The live-room rows moved to
  `db/live-session.dao.ts` (`getHighlightState`/`upsertHighlightState`), and the
  event→course lookup is `course.dao`'s `findIdByEventId` (which
  `clearModuleSpeakerForEvent` now reuses instead of inlining it).

## Non-goals

- No unification of the overlapping hook families
  (`use-event-detail`/`use-speaker-event`,
  `use-event-list`/`use-speaker-events`/`use-upcoming-events`) — their public
  surface stays as-is per the approved plan.
- No auth behavior change.

## Files touched

- 4 files under `src/modules/events/` rewritten (`event-form.tsx`,
  `event-card.tsx`, `use-event-registration.ts`, `event-service.ts` facade);
  12 new files added (`event-form-fields.tsx`, `event-form-schema.ts`,
  `event-status-badge.tsx`, `event-registration-policy.ts`, `event-errors.ts`,
  `event-authz.ts`, `event-crud.ts`, `event-delete.ts`, `event-registration.ts`,
  `event-attendees.ts`, `event-highlight.ts`, `db/live-session.dao.ts`).
- `shared/db/dao/course.dao.ts` gains `findIdByEventId`, which
  `clearModuleSpeakerForEvent` reuses.
- Import sites outside the module updated only where a re-export would otherwise be
  required (none — consumers import the top-level names, and `event-service.ts`
  re-exports every name it always did).

## Verification

- `pnpm typecheck` passes.
- `pnpm test` green — all tests import the same public names as before.
- Every file under `src/modules/events/` is under the 200-line budget.
