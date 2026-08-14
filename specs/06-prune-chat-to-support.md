# 06. Prune chat and routes to support-only

## Goal

Delete the last Q/A residue: the two dead `/api/qa/[eventId]/*` 410 stubs and
the Q/A schemas/types still named in the chat module. The chat module then
contains only support-chat code; `src/shared/types.ts` keeps `QaMessage` (all
module entity types live there) and `ModuleType` keeps its `"qa"` value.

## Run order

Sixth. Safe any time after 02/04, run here so 05's verification is on the final
surface.

## Files touched

- Delete `src/app/api/qa/[eventId]/route.ts`
- Delete `src/app/api/qa/[eventId]/[messageId]/route.ts`
- `src/modules/chat/lib/schemas.ts` — keep only `supportTypeEnum` +
  `sendMessageSchema`
- `src/modules/chat/lib/types.ts` — keep only `ChatMessageWithUser`
- Any test importing chat's Q/A exports (should be none post-05; grep to confirm)

## Prerequisites

- Sheets 01–05 verified.

## Steps

1. `git rm` the two 410 stubs; confirm nothing calls `/api/qa/[eventId]` (grep
   the codebase; only the module/message routes remain live).
2. Delete the leftover Q/A exports from `chat/lib/schemas.ts` and
   `chat/lib/types.ts`.
3. Grep the chat module for `qa|QA` to prove support-only; fix stragglers.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `rg -il "qa" src/modules/chat` returns no files.
- `find src/app/api/qa -type f` shows exactly:
  `module/[moduleId]/route.ts`, `message/[messageId]/route.ts`.

## Risks

- None material; the stubs are 410s that were already unreachable from the UI.
