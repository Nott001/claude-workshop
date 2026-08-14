# 02. Move the course-owned Q/A data layer

## Goal

Create `src/modules/courses/qa/` and move into it everything Q/A owns on the
data side: the DAO, the message schema, the `QaMessageWithUser` type and a
course-owned realtime seam (`subscribeToQaMessagesByModule`, adopted from the
dead copy in `shared/integrations/realtime` and extended to deliver
INSERT/UPDATE/DELETE with a stable channel name). Delete those from their old
homes and repoint the two `/api/qa/*` routes so the tree compiles. The dead
event-scoped `subscribeToQaMessages` is removed.

## Run order

Second, after 01 (routes here consume `shared/lib/rate-limit`).

## Files touched

- Create `src/modules/courses/qa/db/qa-message.dao.ts` (moved)
- Create `src/modules/courses/qa/lib/schemas.ts` (`qaMessageSchema`)
- Create `src/modules/courses/qa/lib/types.ts` (`QaMessageWithUser`)
- Create `src/modules/courses/qa/lib/realtime.ts` (`subscribeToQaMessagesByModule`)
- Delete `src/shared/db/dao/qa-message.dao.ts`
- `src/shared/db/dao/chat.dao.ts` — drop `export * as qaMessageDao`
- `src/shared/integrations/realtime/index.ts` — remove `subscribeToQaMessages`
  and `subscribeToQaMessagesByModule`; keep `unsubscribe`,
  `subscribeToSupportSessions`, `subscribeToCheckins`
- `src/app/api/qa/module/[moduleId]/route.ts`,
  `src/app/api/qa/message/[messageId]/route.ts` — import from `courses/qa`
  instead of `chat.dao` / `chat/lib/schemas`
- Tests: `test/api-qa-module.test.ts`, `test/qa-module-route.test.ts`,
  `test/message-ownership.test.ts` (repoint the mocked `chat.dao` module to
  `@/modules/courses/qa/db/qa-message.dao`)

## Prerequisites

- Sheet 01 verified.

## Steps

1. Move `qa-message.dao.ts` into `courses/qa/db/`, fixing its imports to the
   `@/shared/db/dao/{types,helpers}` absolute paths.
2. Split `qaMessageSchema` out of `chat/lib/schemas.ts` into
   `courses/qa/lib/schemas.ts` unchanged.
3. Split `QaMessageWithUser` out of `chat/lib/types.ts` into
   `courses/qa/lib/types.ts`.
4. Write `courses/qa/lib/realtime.ts`: port `subscribeToQaMessagesByModule`
   from `shared/integrations/realtime`, keying the channel on `moduleId` with a
   stable name (root-cause fix: the `++counter` suffix accumulates dead
   channels on remount), subscribing via `getBrowserClient()` with
   `postgres_changes` on `QA_MESSAGE`, and firing `onInsert`/`onUpdate`/
   `onDelete` callbacks with the raw rows. Reuse `unsubscribe` from
   `shared/integrations/realtime` for teardown.
5. Remove the two `subscribeToQaMessages*` exports from
   `shared/integrations/realtime` and the now-unused `QaMessage` type import.
6. Repoint the two route files to `qaMessageDao` and `qaMessageSchema` imports.
7. Remove the `qaMessageDao` re-export from `chat.dao.ts`.
8. Repoint the three tests' mock modules.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `rg "qa-message.dao|qaMessageDao|subscribeToQaMessages" src/shared src/modules/chat` returns nothing.
- `subscribeToQaMessagesByModule` is exported from
  `src/modules/courses/qa/lib/realtime.ts`; the shared realtime index no longer
  names `QA_MESSAGE`.

## Risks

- The panel still uses the chat-module `useRealtimeMessages` hook through sheet
  05, so the new seam is unused at runtime until then; it is exercised by tests
  from this sheet. Unused-at-runtime code is acceptable mid-series.
- Channel names must be unique per subscriber; the stable name assumes one
  module subscription per page.
