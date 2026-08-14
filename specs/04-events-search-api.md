# 04. Events list search

## Goal

`/api/events` accepts a `search` term (title, venue) so staff search is correct
against the whole event set, not just the 50 already fetched, and
`useEventList` exposes a debounced search the migrated pages drive.

## Run order

Fourth. Depends on sheets 01–02.

## Files touched

- `src/modules/events/db/event.dao.ts` — `list` gains `search`
- `src/modules/events/lib/event-crud.ts` — `listEvents` passes `search`
  through its options
- `src/app/api/events/route.ts` — read `search` from the query string
- `src/modules/events/lib/use-event-list.ts` — debounced `search` state,
  refetch on change, reset page
- Create `src/shared/lib/use-debounced-value.ts` — the debounce hook sheets
  05 and 07 also import
- Tests: update `test/event-table.test.tsx` only if it asserts on the events
  fetch URL; add `test/use-event-list.test.ts` for the debounced search path

## Prerequisites

- Sheets 01–02 complete and verified.

## Steps

1. **DAO** — `event.dao.ts:list` accepts `options.search?: string`. When set,
   apply `query.or(\`title.ilike.${ilikePattern(search)},venue_name.ilike.${ilikePattern(search)}\`)`before the range bounds. Import`ilikePattern`from`@/shared/db/dao/helpers`.
2. **Service** — `event-crud.ts:listEvents` options gain `search?: string`;
   pass it through to `eventDao.list`.
3. **Route** — `/api/events/route.ts` reads `searchParams.get("search")` and
   passes it.
4. **Debounce hook** — `src/shared/lib/use-debounced-value.ts`:
   `useDebouncedValue<T>(value, delayMs = 300)`. Returns the value after it
   has been stable for `delayMs`. `setTimeout`/`clearTimeout` in `useEffect`;
   must clean up on unmount so a stale timer cannot set state after unmount.
5. **Hook** — `use-event-list.ts`: add `search` and `setSearch`; derive
   `debouncedSearch = useDebouncedValue(search)`; include `debouncedSearch` in
   the `load` URL (`search=` only when non-empty) and in the first-page
   effect's dependency array; reset `pageRef` and refetch when it changes.
   `tabCounts`/`filteredEvents` are unaffected — search narrows what the API
   returns.
6. **Tests** — `test/use-event-list.test.ts` stubs `fetch`, asserts the URL
   carries `search=` only after the debounce window elapses (advance fake
   timers), that the page resets to 1, and that an empty search omits the
   param. Add a DAO-level test in the existing test style for
   `event.dao.list` applying the `or(...)` filter when `search` is set.
7. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "search" src/modules/events/lib/use-event-list.ts` shows the debounced
  value feeding the fetch URL.

## Risks

- The search term is interpolated into a PostgREST `or(...)`; `ilikePattern`
  exists precisely to neutralise `,`, `(`, `%`, `_` — do not hand-roll a
  pattern.
- Debounced search fires on the trail of typing; the effect must ignore
  superseded runs (the `cancelled` flag the hook already uses) so an old query
  cannot overwrite a newer one.
