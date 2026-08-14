# 09. Live lock propagation without the page reload

## Goal

Toggling the Q/A lock still reloads the whole page for the staff member who
did it — the room's `handleToggleLock` calls `window.location.reload()` — and
propagates to nobody else: every other viewer keeps the stale lock until they
refresh. The lock is `MODULE.is_locked`; MODULE is already a member of the
`supabase_realtime` publication, grants SELECT to `authenticated`, and has a
`USING (true)` read policy, so a live subscription needs no migration.

Replace the reload with a realtime MODULE subscription: the panel keeps local
lock state seeded from the prop and kept fresh by the channel, and the room
just issues the PATCH.

## Run order

Ninth. Independent of 08 (different tables), but run after it so the smoke test
covers both live behaviors at once.

## Files touched

- `src/modules/courses/qa/lib/realtime.ts` — add `subscribeToModuleLock`
- `src/modules/courses/qa/components/qa-panel.tsx` — local `locked` state
- `src/app/courses/[courseId]/room/page.tsx` — drop `window.location.reload()`
- `test/qa-realtime.test.ts` — seam case
- `test/qa-panel-render.test.tsx` — seam mock + live-update assertions

## Prerequisites

- Sheets 01–08 done. MODULE reads under `authenticated` return rows:
  `SET ROLE authenticated; SELECT count(*) FROM public."MODULE";` is not empty.

## Steps

1. Add `subscribeToModuleLock(moduleId, onLockChange)` to the QA realtime seam:
   stable channel `module-lock-${moduleId}`, `event: "UPDATE"`, schema `public`,
   table `MODULE`, filter `id=eq.${moduleId}`; call `onLockChange` with
   `payload.new.is_locked` only when the payload carries a boolean.
2. In the panel, keep `const [locked, setLocked] = useState(isLocked)`, sync
   `locked` from the `isLocked` prop on change, and subscribe with
   `subscribeToModuleLock(moduleId, setLocked)` (teardown via the shared
   `unsubscribe`). Every `isLocked` reference — the button label, the composer
   guard, the view-only note — reads `locked` instead.
3. In the room, `handleToggleLock` becomes the PATCH only; delete the
   `window.location.reload()` branch. The toggler's own panel picks the change
   up from the channel exactly like everyone else.
4. Tests: `test/qa-realtime.test.ts` pins the seam (filter shape, boolean gate);
   `test/qa-panel-render.test.tsx` mocks the new export and asserts the lock
   renders from the prop, an UPDATE flips the button live, and unmount
   unsubscribes.

## Verification

- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all green.
- Two browser tabs in `pnpm dev` (staff + attendee): the staff toggle
  locks/unlocks with no reload, and both panels update live.
- `rg "window.location.reload" src/app/courses` returns nothing.

## Risks

- MODULE UPDATE payloads carry only the changed columns on the default replica
  identity; `is_locked` is present because it is the column the PATCH changes.
  Do not assume the whole row arrives.
- Two lock togglers race benignly: the last UPDATE wins and every client
  converges on it.
