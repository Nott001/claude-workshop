# 10. Migrate the kiosk attendees panel

## Goal

The kiosk's live attendee list composes the shared primitives. It keeps its
search, status filter, prev/next pagination and realtime check-in refresh, and
a row click opens a details drawer. The kiosk panel has no actions, so the
drawer is information-only.

## Run order

Tenth. Depends on sheets 01–03.

## Files touched

- `src/modules/kiosk/components/attendees-panel.tsx`
- Create `test/attendees-panel.test.tsx`

## Prerequisites

- Sheets 01–09 complete and verified.

## Steps

1. **Table** — replace the hand-rolled `<table>` with the shared primitives
   (columns: Name, Status, Checked In, plus a trailing chevron `TableHeadCell`).
   Keep the avatar + name + email cell composition, swapping the pill for the
   shared `Badge` (success/error/default). Replace the filter buttons with
   `FilterTabs`, the search `Input` with `TableSearch`, and the prev/next
   block with `Pagination`. Keep `subscribeToCheckins` → `refreshKey` and the
   page-reset-on-filter/search handlers.
2. **Drawer** — `const [selected, setSelected] = useState<Attendee | null>(null)`;
   `TableRow` onClick opens it. `Drawer title={selected?.full_name}` shows the
   avatar, name, email, ticket status pill, `issued_at` and `checked_in_at`
   (using the existing `formatTime`). No footer.
3. **Empty state** — swap for `TableEmpty` (`title="No attendees found"`,
   `hint` from `search ? "Try a different search term." : "No attendees match
the current filter."`).
4. **Tests** — create `test/attendees-panel.test.tsx`:
   - renders rows from the stubbed `/api/events/{id}/attendees` fetch.
   - typing in search fires a fetch with `search=` after the debounce and
     resets the page.
   - status tab filters via `status=checked_in`.
   - clicking a row opens the drawer with the attendee's details.
   - pagination calls with `page=2`.
     Follow the fetch-stub pattern in `test/kiosk-scanner-view.test.tsx`.
5. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "<button" src/modules/kiosk/components/attendees-panel.tsx` finds no
  leftover hand-rolled filter buttons (only the drawer's close button).
- Manually in `pnpm dev` at `/staff/events/[id]/kiosk`: scanning a check-in
  still refreshes the list live; clicking a row opens the details drawer.

## Risks

- The kiosk panel lives in a narrow right-hand column beside the scanner; the
  drawer overlays the whole viewport, which is intended.
- The realtime subscription must not be recreated when `selected` changes —
  its effect depends on `eventId`/`refreshKey`, not on the drawer state.
