# 07. Organization search and role filter

## Goal

The organization members endpoint already searches name/email server-side
(`userDao.listStaff`). This sheet adds an optional `role` filter to the API so
the migrated organization page (sheet 12) can filter the roster by role with
the rest of the data — and pins the existing `search` behaviour with a test so
it cannot regress before the page consumes it.

## Run order

Seventh. Depends on sheet 01.

## Files touched

- `src/shared/db/dao/user.dao.ts` — `listStaff` gains `role?`
- `src/app/api/organization/route.ts` — read `role`, pass through
- Tests: extend `test/api-organization-invite.test.ts` or add
  `test/organization-search.test.ts`

## Prerequisites

- Sheets 01–06 complete and verified.

## Steps

1. **DAO** — `user.dao.ts:listStaff` gains `role?: string`. When set, apply
   `.eq("role", role)` on the query (after the `.in("role", [...])` filter,
   so it only narrows). The existing `search` path is unchanged.
2. **Route** — `/api/organization/route.ts` reads `role` from the query
   string, validates it is one of the staff roles, and passes it to
   `listStaff`.
3. **Tests** — assert behavior:
   - `listStaff` with a `role` narrows to that role and keeps pagination.
   - `listStaff` with `search` (name and email) returns only matches.
   - `listStaff` with neither returns the full page.
     Follow the existing DAO test conventions (`mockSupabase`-style builders
     already in `test/`).
4. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.

## Risks

- `role` is interpolated as an `.eq` value; validate it against the known
  staff role list before building the query (the route does this) so an
  arbitrary string cannot reach PostgREST.

## Notes

- The page currently fetches `?pageSize=50` and never paginates. Sheet 12
  drives `search`/`role`/`page` from this API and adds the pagination UI; this
  sheet only guarantees the API can answer.
