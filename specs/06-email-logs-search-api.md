# 06. Email logs search

## Goal

`/api/logs` accepts a `search` term against the recipient's name/email, and
`useEmailLogs` exposes a debounced search. The email logs page (sheet 14) can
then find a specific recipient across the whole table.

## Run order

Sixth. Depends on sheet 04 (debounce hook) and sheet 01.

## Files touched

- `src/shared/db/dao/email.dao.ts` — `list` gains `search`
- `src/shared/integrations/email/log-filter-schema.ts` — accept `search`
- `src/app/api/logs/route.ts` — read `search`, pass through
- `src/shared/integrations/email/use-email-logs.ts` — debounced `search`,
  refetch, reset page
- Tests: add `test/email-dao-search.test.ts`; extend
  `test/log-and-ticket-shapes.test.tsx` (covers `useEmailLogs`) to exercise
  the debounce path

## Prerequisites

- Sheets 01–05 complete and verified.

## Steps

1. **DAO** — `email.dao.ts:list` options gain `search?: string`. The search
   targets the recipient, which is an embedded `USER` row, so resolve ids
   first, then filter: when `search` is set, run
   `USER.select("id").or(\`full_name.ilike.${ilikePattern(search)},email.ilike.${ilikePattern(search)}\`)`,
collect the ids, and apply `.in("user_id", ids.length > 0 ? ids : [-1])`on
the main query —`[-1]`guarantees an empty result instead of matching
every row when nothing matches. Keep the existing`email_type`/`status`/
`user_id`/date filters composing with it.
2. **Schema** — `log-filter-schema.ts` accepts `search` as an optional string
   so the route's `safeParse` does not reject it.
3. **Route** — `/api/logs/route.ts` adds `search` to the filters object it
   builds from the query string.
4. **Hook** — `use-email-logs.ts`: add `search`, `setSearch`; derive
   `debouncedSearch = useDebouncedValue(search)`; include it in the `load`
   URL and in `load`'s deps so the first-page effect refetches; reset
   `pageRef` when it changes.
5. **Tests** — `test/email-dao-search.test.ts` asserts the two-step lookup:
   a matching recipient id narrows the query with `in`, and a search matching
   nobody produces the `[-1]` guard so zero rows come back. Extend the hook
   test with fake timers for the debounce and page reset.
6. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "user_id" src/shared/db/dao/email.dao.ts` shows both the explicit
  `user_id` filter and the search-resolved `in` filter.

## Risks

- The `[-1]` sentinel matters: `in("user_id", [])` would match nothing anyway,
  but `[-1]` also documents the intent and survives PostgREST treating an
  empty array inconsistently. Cover it in the test.
- This is two DB round-trips per search; acceptable for an admin-only audit
  page, but do not add further round-trips.
