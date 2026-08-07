# SPEC-12 — React and hook bug fixes

## Scope

Fix the diagnosed client-side defects: strict-mode stale-state bugs, missing
fetch cancellation, `res.json()`-before-`res.ok` reads, latent NaN from unpadded
date strings, duplicate fetches, and unhandled promise rejections in session
plumbing. Behavior-correcting; no public API changes.

## Background

The audits found a cluster of React/hook bugs, several already diagnosed once in
the codebase and then reintroduced:

- **Stale-state on unmount.** `use-event-list.ts:43-47` documents and fixes the
  strict-mode `setLoading(false)`-after-unmount bug; `use-speaker-events.ts:33,38`
  and `use-speaker-event.ts:33` call `setLoading(false)` _outside_ the `cancelled`
  guard — the same bug, unfixed. `use-tickets.ts:16-30` and `use-payments.ts:16-33`
  have no cancellation at all.
- **`res.json()` before `res.ok`.** `use-speaker-event.ts:30-31` and
  `global-support-chat.tsx:50-51` parse the body before checking status — a
  non-JSON 500 throws and skips the error path.
- **Latent NaN dates.** `new Date(\`${date}T${time}\`)` at 8 unpadded sites
(`use-event-timer.ts:12-13`, `use-room-access.ts:56-57`, `use-event-detail.ts:78`,
`event-session-navbar.tsx:20,42`) while `countdown-timer.tsx:19`pads with`:00`.
An unpadded `"9:00"`can yield`Invalid Date`→ NaN comparisons in`eventStarted`/`eventEnded`.
- **Duplicate fetches.** `staff/events/[id]/page.tsx` fires `useEventSpeakers`
  (`:229`) and `useAssignedSpeakers` (`:138`) for the same endpoint;
  `use-event-detail.ts:40` then `fetch-event-access.ts:17` fetch the same event.
- **Unhandled rejections.** `session-context.tsx:68-70,88-90` chain
  `.then(setUser)` with no `.catch`.
- **Transient-error eviction.** `staff/events/[id]/edit/page.tsx:15-20` raw-fetches
  with no abort and `.catch()` → `router.replace("/staff/events")`, kicking the user
  out on a network blip.

## Changes

- **Cancellation guard.** In `use-speaker-events.ts` and `use-speaker-event.ts`,
  move `setLoading(false)` and the `setEvents`/`setEvent` calls inside the existing
  `cancelled` check, matching `use-event-list.ts`. Add an `AbortController` +
  `cancelled` flag to `use-tickets.ts` and `use-payments.ts` (and the edit-page raw
  fetch). Reuse the repo's shared fetch helper if one exists (see
  `src/shared/lib/fetcher.ts`); otherwise add a small `useFetch`-style guard.
- **Status before body.** In `use-speaker-event.ts` and `global-support-chat.tsx`,
  check `res.ok` and surface a structured error before `res.json()`.
- **One date parser.** Add `src/shared/lib/date-utils.ts` `parseLocalDateTime(date, time)`
  that pads the time to `HH:MM:SS` and returns a validated `Date` (throws/`null` on
  invalid input). Replace the 8 unpadded `new Date(...)` sites; update
  `countdown-timer.tsx` to use it too so padding lives in one place.
- **Duplicate fetches.**
  - `staff/events/[id]/page.tsx`: keep one fetch — either `useAssignedSpeakers`
    (already scoped to the event) or a single `/api/events/[id]/speakers` call —
    and derive the other view from it; drop the redundant hook.
  - `use-event-detail.ts`: return the event from the same request the access check
    uses (or have `fetch-event-access` consume the already-fetched event) instead of
    a second `GET /api/events/[id]`.
- **Session plumbing.** Add `.catch` (log + clear user on auth-check failure) to
  the `session-context.tsx` refresh chains.
- **Edit page.** Replace the raw fetch with the module's hook/state machine and
  only redirect on 403/404, not on transient network errors.

## Non-goals

- No unification of the hook families (`use-event-detail`/`use-speaker-event`, the
  three list hooks) — that stays out of scope per the approved events plan.
- No chat-component rework (SPEC-13 owns `global-support-chat.tsx`'s larger shape;
  only its status-check fix lands here).
- No server behavior changes.

## Files touched

- `src/modules/events/lib/use-speaker-events.ts`, `use-speaker-event.ts`,
  `use-event-timer.ts`, `use-room-access.ts`, `use-event-detail.ts`
- `src/modules/commerce/lib/use-tickets.ts`, `use-payments.ts`
- `src/modules/auth/components/session-context.tsx`
- `src/modules/events/components/event-session-navbar.tsx`,
  `src/modules/courses/components/countdown-timer.tsx`
- `src/shared/lib/date-utils.ts` (new `parseLocalDateTime`)
- `src/app/staff/events/[id]/page.tsx`, `src/app/staff/events/[id]/edit/page.tsx`
- `src/modules/support/components/global-support-chat.tsx` (status-check only)
- Tests: extend hook tests for unmount-safety and aborted fetches; date-parser
  unit test (unpadded `"9:00"`, bad input).

## Verification

- `pnpm test` — new tests pass; no stale-state or NaN regressions.
- `pnpm typecheck` passes.
- Manual in `pnpm dev`: unmount a staff/speaker events page mid-fetch (no
  setState-on-unmounted warnings), open the staff event detail (one speakers
  request), and a `9:00` event renders a live timer without NaN.
