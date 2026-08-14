# 04. Fold route orchestration into a Q/A service

## Goal

Match the repo's "thin route + module service" convention (`support-service.ts`
is the reference): extract every Q/A decision out of the two `/api/qa/*`
handlers into `src/modules/courses/qa/lib/service.ts`. Routes keep only
request parsing, auth gating and error mapping.

## Run order

Fourth, after 02 (service depends on the moved DAO/schema).

## Files touched

- Create `src/modules/courses/qa/lib/service.ts` with, at minimum:
  - `listQuestions(supabase, moduleId)` — DAO cursor call
  - `sendQuestion(supabase, moduleId, userId)` — lock/type/event checks,
    module-scoped rate limit (shared constants), insert
  - `setModuleLock(supabase, moduleId, isLocked)`
  - `deleteQuestion(supabase, messageId, user)` — ownership-or-moderation rule
  - a `requireQaModule` helper (module exists, is `qa`, not locked)
- `src/app/api/qa/module/[moduleId]/route.ts` — thin; keeps `requireAuth`,
  `requireMinRole`, `guardFailure`, `requireModuleAccess`
- `src/app/api/qa/message/[messageId]/route.ts` — thin
- Tests: `test/api-qa-module.test.ts`, `test/qa-module-route.test.ts` — mock
  `courses/qa/lib/service` instead of the DAO; assert behaviour, not shapes

## Prerequisites

- Sheet 02 verified (DAO + schema in `courses/qa`).

## Steps

1. Extract the functions, keeping status codes and messages identical (429 for
   rate limit, 410 semantics not needed post-06).
2. Repoint the routes to consume the service; delete the inline DAO/rate-limit
   bodies from the routes.
3. Update the two route tests to mock the service layer, keeping the existing
   behavioural assertions unchanged.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes.
- No `qaMessageDao` or rate-limit constant is imported directly by any file under `src/app/api/qa/`.
- Response statuses/messages for 400/401/403/404/429/500 are byte-identical to
  the pre-change routes (tests assert these).

## Risks

- Behaviour drift during extraction; the tests are the contract — keep every
  status and error string.
