# Spec Room-0 — Q&A module card (room domain)

> **Run order:** first — standalone behavior fix, no file moves.
> Full sequence: **room-0 → data-0 → curriculum-0 → room-1 → events-0 → events-1 → events-2 → events-3 →
> curriculum-1**.

## Goal

The room page owns the Q&A module card — header `[forum] module_name [lock] [LIVE] [time]` — and
`QAPanel` becomes just the Q&A body (message list, composer, locked banner, empty state). Today the card
chrome (the bordered `bg-surface` shell, the "Q&A" title, the count badge, the lock toggle) lives inside
`QAPanel`, and the room page wraps it in a second header when the module is scheduled. This spec moves the
card chrome to a page-owned component and strips `QAPanel` to its body. No file relocation happens here;
`QAPanel` keeps its current path until room-1.

## Resource viewing note

Lesson resources (pdf, image, video, link) always open in a new browser tab; there is no inline resource
viewer or player (see the policy in curriculum-0 / room-1). This spec does not touch lesson rendering.

## Scope

- `QAPanel` component change only (body-only).
- New co-located `QaModuleCard` at `src/app/courses/[courseId]/room/qa-module-card.tsx`.
- Room page QA branch renders `QaModuleCard`.
- Tests: `test/qa-panel-render.test.tsx`, `test/qa-panel.test.ts`, `test/course-room-page.test.tsx`.
- No schema, no route, no realtime change.

## Implementation

### 1. `QAPanel` → body-only

Remove from `src/modules/chat/components/qa-panel.tsx`:

- The card shell (`rounded-xl border border-border bg-surface shadow-sm overflow-hidden`).
- The header row: forum icon, "Q&A" title, message-count badge, lock toggle button.
- The `onToggleLock` prop.

Keep:

- `isLocked` (renders the locked status banner in the composer zone), `userRole` + `isSpeakerAssigned`
  (moderation floor `isChatStaff(userRole) || isSpeakerAssigned` for delete buttons).
- Initial fetch, realtime (`useRealtimeMessages` on `qa-module-${moduleId}`), composer gating
  (`!eventStarted` / `isLocked` / `eventEnded`), the 429 "Too many messages" message, auto-scroll,
  `formatDateTime`.

The root becomes a plain `flex flex-col min-h-0 flex-1` container with no border or background — the card
border belongs to `QaModuleCard`.

### 2. New `QaModuleCard` (co-located with the room page)

Props:

```ts
interface QaModuleCardProps {
  module: ModuleWithLessons;
  isLive: boolean;
  userRole: UserRole | null;
  isSpeakerAssigned: boolean;
  eventStarted: boolean;
  eventEnded: boolean;
  onToggleLock: () => void;
}
```

Render:

- Container: `overflow-hidden rounded-lg border` with `border-brand ring-1 ring-brand` when `isLive`,
  else `border-border` — the card the page currently owns.
- Header: `border-b border-border bg-muted px-4 py-2`, flex justify-between:
  - Left: forum icon + `module.module_name`.
  - Right (`flex items-center gap-2`): lock toggle (only when `canModerate = isChatStaff(userRole) ||
isSpeakerAssigned`; lock/lock_open glyph + "Locked"/"Unlock" — fire-and-forget, no pending state),
    `LiveNowTag` when `isLive`, `ModuleScheduleBadge` (`start_time`/`end_time`, speaker) only when both
    times are set.
- Body: `<QAPanel moduleId={module.id} userRole={userRole} isSpeakerAssigned={isSpeakerAssigned}
eventStarted={eventStarted} eventEnded={eventEnded} isLocked={module.is_locked} />`.

No nested card, no time strip beyond the header badge. The message-count badge is intentionally omitted:
the card header is chrome only, and the live thread itself is the attendee's signal — restoring the count
would duplicate `QAPanel` state in a second place.

### 3. Room page (`src/app/courses/[courseId]/room/page.tsx`)

The `module_type === "qa"` branch renders `<QaModuleCard ... />` (passing `isLive`, the existing
`handleToggleLock`, and the current props). Content-module branches are untouched.

`isChatStaff` continues to come from `@/modules/chat/lib/types` here; room-1 moves it to shared.

## Tests

- `test/qa-panel-render.test.tsx`: `QAPanel` no longer renders the "Q&A" title, count badge, or lock
  toggle; renders the locked banner when `isLocked`; composer states per `eventStarted`/`isLocked`/
  `eventEnded`; delete buttons per role.
- `test/qa-panel.test.ts`: props updated (no `onToggleLock`); schema untouched.
- `test/course-room-page.test.tsx`: QA card header shows `module_name`, lock toggle for moderators, LIVE
  tag when live, schedule badge when scheduled; body still mounts `QAPanel`.

## Definition of done

- `QAPanel` is body-only; `QaModuleCard` owns the card chrome; no nested card/time strip/count badge.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

File relocation into the room module (room-1), curriculum extraction (curriculum-0), session config
(events-*).
