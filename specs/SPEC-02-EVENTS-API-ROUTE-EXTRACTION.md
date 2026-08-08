# SPEC-02 — Event service extraction

## Scope

Extract the domain logic of the `/api/events/**` route handlers into
`src/modules/events/lib/event-service.ts`, leaving the app-tree handlers as thin
Next.js adapters that guard, parse, call the service, and shape the response.
Pure relocation — request/response behavior is unchanged.

## Background

The `/api/events/**` handlers are Next.js adapters first: they touch `NextResponse`,
`req.json()`, `params`, and `requireAuth`/`requireRole` glue. Moving their bodies
wholesale into the module would relocate that coupling, not remove it, and would
buy nothing — vitest already imports `@/app/api/events/route` directly and calls
`GET(req)`/`POST(req)`. The seam that belongs inside the module is the domain logic
(DAO orchestration, assignment wiring, audit logging), not the HTTP layer.

## Changes

- New `src/modules/events/lib/event-service.ts` exposing the domain operations the
  handlers perform:
  - `listEvents`, `createEvent` (create + facilitator/speaker assignment wiring +
    audit logging, as in `route.ts` today)
  - `getEvent`, `updateEvent`, `deleteEvent` (from `.../[id]/route.ts`)
  - `publishEvent` (from `.../publish/route.ts`)
  - `registerForEvent` (from `.../register/route.ts`)
  - `listEventAttendees` (from `.../attendees/route.ts`)
  - `setEventHighlight`, `clearEventHighlight` (from `.../live/highlight/route.ts`)
- Each service function takes `(supabase, ...args)` — no `Request`, `Response`, or
  `NextResponse` types in its signature.
- Each `src/app/api/events/**/route.ts` handler body shrinks to: run its guard,
  parse input, `await` the service call, map the result/`null`/throw to a
  `NextResponse`. Authorization guards are swapped for the assignment-aware
  `event-service` checks in SPEC-03.
- Tests import the service functions directly (no HTTP shim); existing api-handler
  tests keep calling the route exports.

## Non-goals

- No change to middleware (`src/middleware.ts`): `/api/events` stays public-GET via
  `isPublicApiGet`; the rest stay authenticated.
- No change to guard semantics — role-only checks are tightened in SPEC-03.
- No change to the two `/api/speakers/me/events` handlers; they are covered by the
  DAO move (SPEC-01) only.
- No `routes/` directory — the app tree remains the host seam for HTTP glue.

## Files touched

- `src/modules/events/lib/event-service.ts` (new)
- 6 handler files under `src/app/api/events/**/route.ts` (rewritten as adapters)
- New `test/event-service.test.ts`; api-handler tests updated only where they
  asserted internals the service now owns

## Amendment (post-SPEC-02 review)

The three highlight functions extracted into `event-service` carry the only inline
`supabase.from` chains left in the events module (`LIVE_SESSION_STATE` upserts/reads
and the `COURSE` lookups). They are interim: SPEC-05 re-homes live session state to
the courses module (course-keyed) and removes the highlight functions from
`event-service`, and `deleteEvent`'s `COURSE` lookup is replaced by
`course.dao.findCourseIdByEventId`. Net after SPEC-05: `event-service` holds only
event-domain operations and no inline supabase.

## Verification

- `pnpm test` — service tests and api-handler tests pass against the same URLs.
- `pnpm cf:build` succeeds.
- `rg "from \"@/modules/events/routes"` returns nothing (no such directory).
