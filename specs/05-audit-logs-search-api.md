# 05. Audit logs search

## Goal

`/api/audit-logs` accepts a `search` term across the action, the entity it
touched and the actor who did it, and `useAuditLogs` exposes a debounced
search. The audit page (sheet 13) then searches the whole log, not just the
current page of 20.

## Run order

Fifth. Depends on sheets 01–02 (debounce hook from sheet 04).

## Files touched

- `src/modules/audit/db/audit.dao.ts` — `list` gains `search`
- `src/app/api/audit-logs/route.ts` — read `search`
- `src/modules/audit/lib/use-audit-logs.ts` — debounced `search`, refetch,
  reset page
- Tests: add `test/audit-dao-search.test.ts`; extend
  `test/log-and-ticket-shapes.test.tsx` if it asserts on fetch URLs

## Prerequisites

- Sheet 04 complete and verified (the `useDebouncedValue` hook exists).

## Steps

1. **DAO** — `audit.dao.ts:list` accepts `search?: string`. When set, search
   the action, the entity type and the actor's name/email:
   `query.or(\`action.ilike.${ilikePattern(search)},entity_type.ilike.${ilikePattern(search)}\`)`.
For the actor, mark the embed join inner so PostgREST applies the filter:
change the select to
`"*, ACTOR:actor_id!inner(id, full_name, email)"`only when`search`is
set and add`ACTOR.full_name.ilike.${pattern},ACTOR.email.ilike.${pattern}`to the same`or(...)`. The DAO runs under the service client
(`getServiceClient()` in the route), so the embed filter is not blocked by
   the grant limits the AGENTS.md note warns about.
2. **Route** — `/api/audit-logs/route.ts` reads `searchParams.get("search")`
   and passes it through.
3. **Hook** — `use-audit-logs.ts`: add `search`, `setSearch`; derive
   `debouncedSearch = useDebouncedValue(search)`; include it in the fetch URL
   and the effect deps; reset `page` to 1 when it changes.
4. **Tests** — `test/audit-dao-search.test.ts` asserts the DAO builds the
   `or(...)` filter with the escaped pattern when `search` is set and skips it
   when empty. Extend the hook test with fake timers to assert the debounce:
   typing does not refetch, the elapsed window does, page resets to 1.
5. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "!inner" src/modules/audit/db/audit.dao.ts` shows the embed join is only
  made inner when a search term is present.

## Risks

- The actor filter is an embedded PostgREST join. Under the service role it is
  safe, but the query shape (`ACTOR!inner`) must be verified against a live
  DB before the sheet is considered done — a wrong join silently drops the
  embed and the page renders actors as "Unknown". `pnpm dev` against the local
  DB in step 4 covers this.
- PostgREST `or(...)` precedence: conditions are separated by commas; quoting
  through `ilikePattern` keeps user input from splitting the expression.
