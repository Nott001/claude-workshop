# SPEC-00 — Events module layout & dependency boundary

## Scope

Establish the target directory structure for `src/modules/events/`, the contract for
every app-tree route it feeds, and the dependency-direction rule that keeps the
modular monolith honest. Also reconcile a naming collision. No behavior change.

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
  `courses/`, `chat/`, `commerce/`, or `kiosk/` imports `@/modules/events`.
- Move `src/modules/events/components/attendees-panel.tsx` →
  `src/modules/kiosk/components/attendees-panel.tsx` and update the single import
  in `src/modules/kiosk/components/kiosk-scanner-view.tsx`. The panel is kiosk
  attendance/check-in code — a live attendee feed over `subscribeToCheckins` used
  only to verify a registered user's access to the in-person event. The events
  module never renders it (staff shows a count via `use-event-detail`), so it has
  no bearing on the event room. Relocating it removes the cross-module dependency
  entirely: after the move no kiosk file imports events and no events file imports
  kiosk (the boundary test pins this).
- Rename `lib/session-timeline.ts` → `lib/timeline.ts` to end the collision with
  `components/session-timeline.tsx`; the `buildTimeline` export is unchanged; update
  imports in `components/session-timeline.tsx` and `test/session-timeline.test.ts`.

## Non-goals

- No other file moves yet — this spec only fixes structure, dead code, and
  naming. The attendees-panel relocation to the kiosk module is the exception: it
  is kiosk check-in code that was misplaced in events, not part of the events
  restructure.
- No authorization changes (SPEC-03).
- No barrel `index.ts` for the module.

## Files touched

- `test/event-module-boundary.test.ts` (new)
- `src/modules/events/lib/session-timeline.ts` → `src/modules/events/lib/timeline.ts`
  (+ 2 import sites)
- `src/modules/events/components/attendees-panel.tsx` →
  `src/modules/kiosk/components/attendees-panel.tsx` (+ 1 import site)

## Verification

- `pnpm test` — new boundary tests pass; `pnpm typecheck` passes after the rename.
- `rg "@/modules/kiosk/components/attendees-panel" src` — the only importer is
  `src/modules/kiosk/components/kiosk-scanner-view.tsx`; `rg attendees-panel
src/modules/events` returns nothing (the panel left the events module).
