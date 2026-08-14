# 01. Neutralise the genuinely shared helpers

## Goal

Q/A will import nothing from the chat module once it moves into courses. The
helpers it genuinely shares with support chat move to neutral `src/shared/`
first so chat stops owning them: `MessageComposer`, the chat/Q&A rate-limit
constants and `isChatStaff`. Q/A code is not moved yet — it stays in the chat
module, just importing from the new shared homes.

## Run order

First. Every later sheet assumes these files already live in `src/shared/`.

## Files touched

- Create `src/shared/components/message-composer.tsx` (moved)
- Create `src/shared/lib/rate-limit.ts` (moved)
- Create `src/shared/lib/is-chat-staff.ts` (moved)
- Delete `src/modules/chat/components/message-composer.tsx`
- Delete `src/modules/chat/lib/rate-limit.ts`
- `src/modules/chat/lib/types.ts` — remove `isChatStaff` (keep
  `ChatMessageWithUser`, `QaMessageWithUser`)
- Repoint importers:
  - `src/modules/chat/components/qa-panel.tsx` (isChatStaff, MessageComposer)
  - `src/modules/support/components/global-support-chat.tsx` (both)
  - `src/modules/chat/lib/support-service.ts` (rate-limit)
  - `src/app/api/qa/module/[moduleId]/route.ts` (rate-limit)
- Tests: `test/chat.test.ts` (rate-limit), `test/qa-panel.test.ts` (isChatStaff)

## Prerequisites

- Working tree clean, on branch `feat/qa-courses-submodule`, created in this
  sheet.

## Steps

1. `git switch -c feat/qa-courses-submodule`.
2. Move/rewrite each helper into `src/shared/` with the same exported symbol
   names so callers change only their import specifier.
3. Repoint every importer listed under Files touched.
4. Update the `isChatStaff` doc comment to state it floors both QA and support
   panels and now lives in shared.
5. Update the two tests' import specifiers.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `rg "modules/chat/(components/message-composer|lib/rate-limit)"` finds nothing.
- `isChatStaff` is exported from `src/shared/lib/is-chat-staff.ts` only.

## Risks

- The chat module still physically holds Q/A files after this sheet; that is
  expected and resolved by sheets 02–06.
