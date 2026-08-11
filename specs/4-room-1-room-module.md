# Spec Room-1 — extract the room module + Q&A submodule (room domain)

> **Run order:** fourth — completes the courses split and deletes the courses module.
> Full sequence: room-0 → data-0 → curriculum-0 → **room-1** → events-0 → events-1 → events-2 → events-3 →
> curriculum-1.

## Goal

Move the live-session experience into `src/modules/room/` and finish the courses split. Q&A becomes a room
submodule (`room/qa/`). The room page body moves into the module (`pages/room-page.tsx`) and
`src/app/events/[eventId]/room/page.tsx` becomes a thin render. `src/modules/courses/` is deleted. **API
URLs are already final** (data-0: `/api/room/[eventId]`, `/api/room/[eventId]/highlight`, `/api/qa/*`);
routes only repoint their imports at `@/modules/room/*`.

## Resource viewing policy

Room lesson rows already open `content_url` in a new tab (`target="_blank" rel="noopener noreferrer"`)
for pdf, image, video, and link — preserve exactly that. There is no inline resource viewer or player in
the room; `content-type-meta` drives only the row icon.

## Scope

- New `src/modules/room/`: `pages/`, `components/`, `lib/`, `db/`, `qa/` submodule.
- Move room code from courses + the room-only components from events.
- Relocate Q&A from chat into `room/qa`; move `isChatStaff` to shared.
- Update API-route imports; delete the courses module; update tests.

## Implementation

### 1. From courses → room

- `components/`: `current-topic-card.tsx`, `room-lesson-row.tsx`, `module-schedule-badge.tsx`.
- `lib/`: `use-room-access.ts` (was `use-course-room-access.ts`; `useCourseRoomAccess` →
  `useRoomAccess`), `fetch-room-access.ts` (was `fetch-course-room-access.ts`), `room-access-policy.ts`,
  `current-topic.ts`, `live-session-service.ts`, `curriculum-errors.ts` (was `course-errors.ts`),
  `content-type-meta.ts`.
- `db/`: `live-session.dao.ts`.
- Page: body of `src/app/events/[eventId]/room/page.tsx` → `room/pages/room-page.tsx`
  (export `RoomPage`, was `CourseRoomPage`); the app page renders it. `QaModuleCard` (room-0) moves to
  `room/qa/components/qa-module-card.tsx`.

### 2. From events → room (room-only components)

`session-hero.tsx`, `event-session-navbar.tsx`, `live-now-tag.tsx`, `progress-bar.tsx` — verify no
non-room consumers first (countdown-timer and event-schedule stay in events).

### 3. Q&A submodule `room/qa/`

- `components/`: `qa-panel.tsx` (from `chat/components`), `qa-module-card.tsx`.
- `lib/schemas.ts`: `qaMessageSchema` (from `chat/lib/schemas.ts`).
- `lib/types.ts`: `QaMessageWithUser` (from `chat/lib/types.ts`).
- Shared: `isChatStaff` → `src/shared/lib/chat-staff.ts`; `room/qa/components/qa-panel.tsx` and
  `src/modules/support/components/global-support-chat.tsx` import it from shared.
- `chat` keeps `MessageComposer` and `use-realtime-messages.ts` (shared with support); room imports them
  from `@/modules/chat/*` (room → chat is an allowed edge).

### 4. API routes (URLs already final — data-0)

- `src/app/api/qa/module/[moduleId]/route.ts`, `src/app/api/qa/message/[messageId]/route.ts` →
  `@/modules/room/*` imports (qa schemas/types; `requireModuleAccess` from shared curriculum-access).
- `src/app/api/room/[eventId]/route.ts` and `src/app/api/room/[eventId]/highlight/route.ts` →
  `@/modules/room/*`.
- The deprecated 410 `qa/[eventId]` stubs are untouched.

### 5. Module boundary

- **room must not import events.** The room feed already embeds the EVENT row; events-3 keeps it that way
  (session data rides the feed, never an events import).
- room may import curriculum types / shared / chat.
- curriculum must not import room/events (enforced since curriculum-0).
- Delete `src/modules/courses/` — its only remaining content was room-side.
- `test/module-boundary.test.ts`: drop the temporary "courses may not import curriculum" rule; assert the
  final edges (curriculum ⊥ room, room ⊥ events).

### 6. Types

`ModuleWithLessons` / `CurriculumSpeaker` already live in `shared/types.ts` (curriculum-0);
`curriculum-access` is already shared. No re-declaration in room.

## Tests

Repoint the room/QA tests: `room-page` (was `course-room-page`), `use-room-access`, `fetch-cancellation`,
`room-access`, `room-lesson-row`, `current-topic`, `current-topic-card`, `api-room-route` (was
`api-course-room-route`), `api-live-highlight-route`, `live-session-dao`, `live-session-service`,
`module-schedule-badge`, `qa-panel-render`, `qa-panel`, `api-qa-module`, `qa-module-route`,
`message-ownership`, `use-realtime-messages`, `chat` (isChatStaff import). Add boundary assertions for
`room` ⊥ `events`.

## Definition of done

- courses module deleted; room + curriculum modules stand, final boundaries enforced.
- Q&A fully under `room/qa`; `isChatStaff` shared; composer/realtime still from chat.
- Every lesson link still opens a new tab.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

Session schedule (events-0…3), any behavior change beyond relocation.
