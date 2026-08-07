# SPEC-10 — Route-as-service extraction

## Scope

Pull the domain orchestration out of four oversized app-tree route handlers into
module service layers, applying the SPEC-02 pattern (route = thin Next.js adapter;
module = pure domain logic). Pure relocation of behavior — request/response
contracts unchanged, guards already settled by SPEC-08.

## Background

These handlers are the worst offenders of "route-as-service-layer": they inline
multi-DAO orchestration and domain rules that belong in their modules, so the
modules have no server-side logic to test.

- `src/app/api/support/route.ts` (140 lines) — case claim/assignment rules
  (`:95-108`), session create-or-reuse (`:110-125`), rate limiting (`:85-91`).
- `src/app/api/modules/[id]/route.ts` (128 lines) — speaker-assignment validation
  (`:43-50`), time-overlap merge/conflict resolution (`:56-72`), storage cleanup on
  delete (`:104-115`).
- `src/app/api/organization/route.ts` (152 lines) — stale-account cleanup
  (`:79-88`), invite link generation (`:94-105`), email send (`:131-143`), plus
  `supabase.auth.admin` calls.
- `src/app/api/events/[id]/route.ts` (180 lines) — the DELETE handler's
  cascade-delete walk (`:127-157`) is pure domain logic sitting next to the
  SPEC-02/03 event-service handlers.

## Changes

- New service layers in their modules (following `events/lib/event-service.ts` and
  `commerce/lib/payment-gateway.ts` as references):
  - `src/modules/chat/lib/support-service.ts` — `claimCase`, `releaseCase`,
    `openOrReuseSession`, `rateLimitCheck` (move the `support/route.ts` rules).
  - `src/modules/courses/lib/course-module-service.ts` — `createModule` with
    assignment validation, `mergeConflictingTimes`, `deleteModuleWithStorage`.
  - `src/modules/auth/lib/organization-service.ts` — `inviteUser`,
    `cleanupStaleAccounts`, `generateInviteLink`, `sendInviteEmail`.
  - `src/modules/events/lib/event-service.ts` (extended) — the DELETE cascade walk
    moves from `api/events/[id]/route.ts` into `deleteEventWithDependencies`.
- Each service function takes `(supabase, ...args)` — no `Request`/`Response`/
  `NextResponse` in its signature.
- The four route handlers shrink to: run the SPEC-08 guard, parse input, call the
  service, map the result/`null`/throw to `NextResponse`. `auth.admin` calls stay
  behind the `organization-service` seam (the Worker needs its service-role client
  there, as today).
- Unit tests import the services directly (no HTTP shim); existing api-handler
  tests keep calling the route exports.

## Non-goals

- No URL, middleware, or request/response contract changes.
- No changes to rate-limit thresholds or invite/claim business rules — moved, not
  rewritten.
- The events DELETE walk is the only event-route behavior touched here; everything
  else in `api/events/**` was already extracted by SPEC-02/03.

## Files touched

- `src/modules/chat/lib/support-service.ts` (new)
- `src/modules/courses/lib/course-module-service.ts` (new)
- `src/modules/auth/lib/organization-service.ts` (new)
- `src/modules/events/lib/event-service.ts` (extend with cascade delete)
- 4 handlers: `api/support/route.ts`, `api/modules/[id]/route.ts`,
  `api/organization/route.ts`, `api/events/[id]/route.ts`
- New `test/support-service.test.ts`, `test/course-module-service.test.ts`,
  `test/organization-service.test.ts`; extend `test/event-service.test.ts`

## Verification

- `pnpm test` — new service tests + existing api-handler tests green.
- `pnpm typecheck` — services compile without Next.js types.
- `pnpm cf:build` succeeds.
- Manual: invite flow, module create/delete, support case claim still behave the
  same (request/response unchanged).
