# SPEC-01 — Event DAO relocation

## Scope

Move `src/shared/db/dao/event.dao.ts` into the events module as
`src/modules/events/db/event.dao.ts` and update every consumer. Mechanical move —
signatures, SQL, and exports stay identical.

## Background

`event.dao` is the events domain's own persistence, living today in the shared
`src/shared/db/dao/` folder. As the module becomes self-contained, its DAO belongs
under `src/modules/events/db/`. In contrast, `facilitator.dao` and `speaker.dao`
remain in shared: `src/modules/courses/lib/course-access.ts` imports both for
`canManageEvent`, and moving them would force a forbidden `courses → events` import.

## Changes

- `src/shared/db/dao/event.dao.ts` → `src/modules/events/db/event.dao.ts`; identical
  contents, update the internal import path for the query/filter utilities if any.
- Update the `event.dao` import site in each of the 12 consumers:
  - `src/app/api/events/route.ts`
  - `src/app/api/events/[id]/route.ts`
  - `src/app/api/events/[id]/publish/route.ts`
  - `src/app/api/events/[id]/register/route.ts`
  - `src/app/api/events/[id]/live/highlight/route.ts`
  - `src/app/api/speakers/me/events/route.ts` and `[eventId]/route.ts`
  - `src/app/api/upload/event-image/route.ts`
  - `src/app/api/storage/[bucket]/[...path]/route.ts`
  - `src/app/api/checkin/route.ts`
  - `src/app/page.tsx` (landing page)
  - `src/app/events/[id]/edit/page.tsx`
- Update the ~12 test files that import `event.dao` (events CRUD, api handlers,
  registration, landing/home cards, status derivation) to the new path.

## Non-goals

- No changes to the DAO's SQL, result types, or exported names.
- No extraction of API handlers into the module yet (SPEC-02) — only their imports
  change here.

## Files touched

- `src/modules/events/db/event.dao.ts` (new)
- `src/shared/db/dao/event.dao.ts` (deleted)
- 12 import sites + ~12 test files (path updates only)

## Verification

- `pnpm typecheck` passes with no `shared/db/dao/event.dao` references.
- `rg "event.dao" src test` lists only the module's new path.
- `pnpm test` green.
