# 13. Migrate the email logs page

## Goal

The email logs page composes the shared primitives, keeps its email-type and
status selects, gains a debounced user search (sheet 07), and opens a drawer
with the full log record on row click.

## Run order

Thirteenth. Depends on sheets 01–03, 06.

## Files touched

- `src/app/staff/emails/page.tsx`
- Create `test/emails-page.test.tsx`

## Prerequisites

- Sheets 01–12 complete and verified. `/api/logs` accepts `search`;
  `useEmailLogs` exposes `search`/`setSearch` (sheet 07).

## Steps

1. **Toolbar** — render `TableSearch value={search} onChange={setSearch}`
   next to (or above) the two existing `Select`s for email type and status;
   `useEmailLogs` owns the debounce and page reset.
2. **Table** — swap for the shared primitives (columns: User, Email Type,
   Status, Sent At, trailing chevron). Keep the status pill, rendering it
   through the shared `Badge` (success/error). `TableRow` onClick opens the
   drawer.
3. **Drawer** — `selected: EmailLogWithUser | null`; body: user name/email,
   email type label, status pill, `sent_at` and `created_at` full timestamps,
   and the record `id`. No footer.
4. Keep `LoadMoreButton` for the append-style pagination (unchanged from
   today); the drawer state must not disturb `loadMore`.
5. **Tests** — create `test/emails-page.test.tsx`: renders rows; typing search
   fires `search=` after the debounce; the type/status selects still drive
   their params; clicking a row opens the drawer with the full record; Load
   more still appends. `src/app/**/page.tsx` is excluded from coverage, so
   these are behaviour tests.
6. Raise `vitest.config.ts` thresholds only if component code in
   `src/shared` gained branches.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- Manually in `pnpm dev` (admin): search a recipient, combine with the type
  and status filters, open a row, load more.

## Risks

- `useEmailLogs.load` composes `search` with the existing filters; the search
  param must not be sent when empty (sheet 07 makes it conditional) or every
  keystroke-clear fires a redundant full list fetch.
