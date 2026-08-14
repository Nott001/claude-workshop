# 05. Move the panel into courses and adopt its realtime seam

## Goal

Move `QAPanel` into `src/modules/courses/qa/components/` and switch its live
subscription from the chat module's `useRealtimeMessages` hook to the owned
`subscribeToQaMessagesByModule`. Rich insert enrichment is preserved by
refetching `GET /api/qa/message/:id` on INSERT, exactly as the hook did. The
chat-module hook is then stripped to support chat only (`CHAT_MESSAGE`).

## Run order

Fifth, after 03 (panel behaviour now depends on the realtime migration) and 04.

## Files touched

- Move `src/modules/chat/components/qa-panel.tsx` →
  `src/modules/courses/qa/components/qa-panel.tsx`
- `src/app/courses/[courseId]/room/page.tsx` — repoint the QAPanel import
- `src/modules/chat/lib/use-realtime-messages.ts` — drop `QA_TABLE` and the
  `/api/qa/message` branch of `fetchEnriched`; it becomes support-only
- Tests: `test/qa-panel-render.test.tsx` (import path + subscription mock now
  exercises `subscribeToQaMessagesByModule`), `test/qa-panel.test.ts`
  (schema import → `courses/qa`), `test/use-realtime-messages.test.tsx`
  (remove QA cases)

## Prerequisites

- Sheets 01–04 verified.

## Steps

1. `git mv` the panel into `courses/qa/components/`; keep `MessageComposer`
   (shared) and `isChatStaff` (shared) imports.
2. Replace `useRealtimeMessages` with a `useEffect` that calls
   `subscribeToQaMessagesByModule(moduleId, callbacks)` and returns
   `unsubscribe` cleanup. On INSERT, refetch the enriched message via
   `GET /api/qa/message/:id` using the existing dedicated GET route, then
   append deduplicated; on UPDATE merge raw rows; on DELETE filter by id.
   Keep initial `GET /api/qa/module/:id` load as-is.
3. Strip the QA arms from the chat hook and its test.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes; `test/qa-panel-render.test.tsx` asserts insert/update/
  delete delivery through the new seam and the enrichment refetch.
- `rg "QA_TABLE|api/qa/message" src/modules/chat` returns nothing.
- `use-realtime-messages` no longer names `QA_MESSAGE`.

## Risks

- Adopting client-side realtime makes friendlier live updates depend on
  delivery to the signed-in role (sheet 03 hardens this). If delivery is ever
  blocked by RLS, the panel still loads via REST and only misses live rows.
- The stable channel name must not collide across panels; the room renders one
  module subscription per `moduleId`.
- Sockets changed; smoke the isolate runtime in sheet 07 (`pnpm cf:preview`).
