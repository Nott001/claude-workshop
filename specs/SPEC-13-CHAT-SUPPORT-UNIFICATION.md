# SPEC-13 — Chat and support unification

## Scope

Collapse the triplicated chat stack onto one subscription, one composer, one
message type, and one owner, and make the support module a consumer of the chat
module instead of a second implementation. Consolidates the browser-side realtime
access that SPEC-11 deferred.

## Background

Three near-identical chat UIs exist, each re-implementing the same pieces:

- `src/modules/chat/components/chat-panel.tsx` (161 lines) and
  `src/modules/support/components/global-support-chat.tsx` (272 lines) each hand-roll
  a `postgres_changes` subscription (`chat-panel.tsx:43-74`, `global-support-chat.tsx:69-108`),
  a `ChatMessageWithUser` type (3 copies: `use-support-cases.ts:22`,
  `chat-panel.tsx:8`, `global-support-chat.tsx:11`), and a composer
  (`global-support-chat.tsx:244-267` vs `qa-panel.tsx:214-238`).
- `qa-panel.tsx` adds a 4th message type (`QaMessageWithUser:8`) and defines
  "staff" as `speaker` (`:31`) while the chat panel's floor is `facilitator`
  (`chat-panel.tsx:30`) — inconsistent role policy on the same data.
- `global-support-chat.tsx:5,7` reaches into `@/shared/db/dao/chat.dao` and the
  realtime integration directly — two modules own the chat domain.
- All three embed `Date.now()` in channel names (`chat-panel.tsx:43`,
  `qa-panel.tsx:42`, `global-support-chat.tsx:69`), defeating strict-mode cleanup
  and leaking a channel per mount.
- `chat-panel.tsx:59`, `global-support-chat.tsx:84`, `use-support-cases.ts:77`, and
  `qa-panel.tsx:56-57` run DAO/realtime queries from the browser under the anon key —
  the failure class AGENTS.md warns about.

## Changes

- **One realtime subscription hook.** New
  `src/modules/chat/lib/use-realtime-messages.ts` encapsulating channel subscribe /
  unsubscribe (stable channel name derived from the resource id, not `Date.now()`),
  insert/delete/update handling, and a single `ChatMessageWithUser` type. Used by
  `chat-panel.tsx`, `qa-panel.tsx`, and `global-support-chat.tsx`.
- **One composer.** Extract `src/modules/chat/components/message-composer.tsx`
  (input, send, optimistic append) shared by the three panels; remove the duplicated
  composer markup.
- **One message type + role policy.** `src/modules/chat/lib/types.ts` exports
  `ChatMessageWithUser` (and `QaMessageWithUser` as a thin alias); delete the 4
  duplicate interfaces. Move the `hasMinRole`-based "is staff" check into one helper
  in `src/modules/chat/lib/` and make QA's staff floor explicit (SPEC-08's
  `requireMinRole`-style decision applied client-side — align `qa-panel`'s `speaker`
  floor with the server rule from SPEC-08 rather than leaving two literals).
- **Ownership: support consumes chat.** `global-support-chat.tsx` imports the
  subscription hook, composer, and types from `@/modules/chat/*`; delete its inline
  subscription/DAO usage. `chat.dao` stays owned by chat (support stops importing it
  directly).
- **Browser data access.** Move the attendee-name enrichment (`findMessageWithUser`
  in `chat-panel.tsx:59`, `global-support-chat.tsx:84`, `use-support-cases.ts:77`)
  server-side: POST responses and the realtime hook receive pre-joined
  `full_name`/`role` (the DAO already returns it — stop re-querying). `qa-panel.tsx`
  drops the raw inline `QA_MESSAGE` query for the DAO-backed endpoint the other
  panels already use.
- **Case detail.** `case-detail.tsx` + `message-list` + `message-composer` render
  through the shared hook/components so support inbox and the live panels converge.

## Non-goals

- No schema or DAO changes (SPEC-11 owns DAO error-handling; the chat DAOs are
  untouched here except for browser-call removal).
- No change to the events/courses chat UIs beyond adopting the shared pieces.
- No behavior change to message content, ordering, or the case workflow.

## Files touched

- `src/modules/chat/lib/use-realtime-messages.ts`, `lib/types.ts` (new)
- `src/modules/chat/components/message-composer.tsx` (new)
- `src/modules/chat/components/chat-panel.tsx`, `qa-panel.tsx`,
  `lib/use-support-cases.ts` (refactor onto shared pieces)
- `src/modules/support/components/global-support-chat.tsx`,
  `components/case-detail.tsx` (consume chat module)
- Tests: realtime-hook test (channel lifecycle, strict-mode cleanup); composer
  test; `qa-panel`/`chat-panel` render tests via the shared components.

## Verification

- `pnpm test` green, including the realtime-hook lifecycle test.
- `rg 'Date.now\\(\\)|CHAT_MESSAGE"|findMessageWithUser' src/modules/*/components` —
  no inline channel `Date.now()`, table literal, or client enrichment left.
- `pnpm cf:build` succeeds.
- Manual in `pnpm dev`: open a live chat, QA, and support case side by side — all
  update in place, survive strict-mode remount without duplicate channels, and
  send/optimistic-append identically.
