# SPEC-00 — Events module layout & dependency boundary

## Scope

Establish the target directory structure for `src/modules/events/`, the contract for
every app-tree route it feeds, and the dependency-direction rule that keeps the
modular monolith honest. Also remove the module's dead code and reconcile a naming
collision. No behavior change.

## Background

Event logic today is spread across three URL trees (`/events`, `/staff/events`,
`/speaker/event`), `/api/events/**`, `src/shared/db/dao/event.dao.ts`, and a flat
`src/modules/events/` of `components/` + `lib/`. The module is being made
self-contained: richer layout, one-way imports (`events → courses → chat/commerce`),
and a test that pins the rule the way `test/module-boundary.test.ts` pins courses.

## Changes

Target layout:

```
src/modules/events/
  components/   # presentational + split field components (SPEC-04)
  lib/          # hooks, schemas, types, policies, event-service (SPEC-02/03)
  db/           # event.dao.ts (moved in SPEC-01)
  pages/        # page components consumed by the three app trees (SPEC-06)
```

- App-tree `page.tsx` files are thin shells: they render the module's page
  component (e.g. `<EventRoom variant="staff" />`) or re-export it, and keep any
  `metadata`/`generateMetadata`/segment-config exports local to the app tree.
- API `route.ts` handlers **stay in the app tree** as Next.js adapters (they use
  `NextResponse`, `req`, `params`); their domain logic lives in
  `src/modules/events/lib/event-service.ts`. The app tree is the host-specific
  seam — do not drag Next.js glue into the module.
- `test/event-module-boundary.test.ts` (new, mirrors `test/module-boundary.test.ts`):
  no file under `src/modules/events` imports from `@/app/**`; no file under
  `courses/`, `chat/`, or `commerce/` imports `@/modules/events`.
- Delete `src/modules/events/components/attendees-panel.tsx` (never imported).
- Rename `lib/session-timeline.ts` → `lib/timeline.ts` to end the collision with
  `components/session-timeline.tsx`; the `buildTimeline` export is unchanged; update
  imports in `components/session-timeline.tsx` and `test/session-timeline.test.ts`.

## Non-goals

- No file moves yet — this spec only fixes structure, dead code, and naming.
- No authorization changes (SPEC-03).
- No barrel `index.ts` for the module.

## Files touched

- `test/event-module-boundary.test.ts` (new)
- `src/modules/events/components/attendees-panel.tsx` (deleted)
- `src/modules/events/lib/session-timeline.ts` → `src/modules/events/lib/timeline.ts`
  (+ 2 import sites)

## Verification

- `pnpm test` — new boundary tests pass; `pnpm typecheck` passes after the rename.
- `rg "attendees-panel"` returns nothing.
