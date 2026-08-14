# 12. Migrate the audit logs page

## Goal

The audit logs page composes the shared primitives, gains server-side search
(sheet 05) and a category filter, replaces its prev/next buttons with the
shared `Pagination`, and opens a drawer with the full metadata on row click.

## Run order

Twelfth. Depends on sheets 01–03, 05.

## Files touched

- `src/app/staff/audit-logs/page.tsx`
- Create `test/audit-logs-page.test.tsx`

## Prerequisites

- Sheets 01–11 complete and verified. `/api/audit-logs` accepts `search`;
  `useAuditLogs` exposes `search`/`setSearch` (sheet 05).

## Steps

1. **Category filter** — derive `categories` from the existing `actionLabel`
   table: `all` plus `created`, `deleted/removed`, `updated`, `assigned`,
   `check-in`, `invited` (map by substring as `actionColor` already does).
   `FilterTabs` selects the category; a non-`all` category filters the loaded
   `logs` client-side for now (audit pagination is page-based, so a
   category-true count needs no API change — note this in the commit body if
   it later proves too coarse).
2. **Toolbar** — render `TableSearch value={search} onChange={setSearch}`
   above the `FilterTabs`; `useAuditLogs` owns the debounce.
3. **Table** — swap for the shared primitives (columns: Action, Actor,
   Details, Date, trailing chevron). Keep `actionLabel`/`actionColor` for the
   action pill (via shared `Badge` with the derived variant). `TableRow`
   onClick opens the drawer; actor name/email column keeps its stacked layout.
4. **Pagination** — replace the two prev/next buttons + "Page X of Y" with
   `Pagination page={page} pageSize={20} total={...} onPageChange={setPage}`.
   `useAuditLogs` returns `totalPages`, not `total`; extend it to also expose
   `total` (the route already returns it) so `Pagination` can compute the
   range.
5. **Drawer** — `selected: AuditLogWithActor | null`; body: action pill,
   actor name/email, `entity_type #id`, and `metadata` rendered as pretty
   JSON (`JSON.stringify(metadata, null, 2)`) in a `<pre>` block instead of
   the current 80-char truncation, plus the full `created_at` timestamp.
   No footer.
6. **Tests** — create `test/audit-logs-page.test.tsx`: renders logs; typing
   search fires `search=` after the debounce and resets the page; clicking a
   row opens the drawer and shows the full metadata JSON; pagination drives
   `page=`. The page is a `src/app/**/page.tsx` (excluded from coverage) so
   these are behaviour tests, not coverage obligations.
7. Raise `vitest.config.ts` thresholds only if component code inside
   `src/modules` gained branches; `src/app/**/page.tsx` is excluded.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "slice\(0, 80\)|JSON.stringify" src/app/staff/audit-logs/page.tsx` shows
  the truncation is gone and the drawer renders full JSON.
- Manually in `pnpm dev` (admin): search an actor's name, page through, open a
  row and read the full metadata.

## Risks

- Client-side category filtering over a page of 20 can look wrong when the
  category counts span pages. Acceptable for this sheet; call it out in the
  commit body so a later sheet can move it server-side if staff report it.
- Extending `useAuditLogs` with `total` touches the hook — update its test in
  `test/log-and-ticket-shapes.test.tsx` if the returned shape is asserted.
