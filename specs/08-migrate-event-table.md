# 08. Migrate the event tables

## Goal

The staff events tables — the admin full list and the facilitator's assigned
list — compose the shared primitives, gain a search box, and drop their
in-cell Open/Kiosk/Edit links for a drawer opened by clicking a row. The event
Title stays a link that navigates (stopPropagation on the row's click).

## Run order

Eighth. Depends on sheets 01–04 (primitives, toolbar, drawer, events search
API + `useEventList.search`).

## Files touched

- `src/modules/events/components/event-table.tsx`
- `src/modules/events/pages/staff-event-list.tsx`
- `src/modules/events/pages/assigned-event-list.tsx`
- Tests: `test/event-table.test.tsx`, `test/staff-event-list.test.tsx`,
  `test/assigned-event-list.test.tsx`

## Prerequisites

- Sheets 01–07 complete and verified. `useEventList` exposes `search`/`setSearch`
  (sheet 04).

## Steps

1. **`event-table.tsx`** — keep the `EventTableRow` type and the
   `basePath`/`showKiosk`/`showEdit` props (they now decide which links the
   drawer shows). Replace the hand-rolled `<table>` with
   `TableContainer`/`Table`/`TableHead`/`TableHeadCell`/`TableBody`/
   `TableRow`/`TableCell`. Columns: Title, Date, Time, Venue, Status,
   Attendees, plus one empty `TableHeadCell` carrying the trailing chevron.
   - `TableRow` gets `onClick={() => setSelected(event)}` and `aria-label`
     like `Open ${event.title}`; its final cell renders a `chevron_right`
     material icon in `text-muted-fg`.
   - The Title cell keeps `<Link href={basePath/id}>` with
     `onClick={(e) => e.stopPropagation()}` so title clicks navigate, not
     open the drawer.
   - Status cell renders the existing `EventStatusBadge`.
   - Empty state uses `TableEmpty` (`title="No events found"`).
   - **Drawer** at the bottom: `Drawer open={selected !== null}
onOpenChange={(o) => !o && setSelected(null)} title={selected?.title}`.
     Body: date/time, venue, `EventStatusBadge`, attendee count. Footer:
     links styled as buttons — `Open` always, `Kiosk` when `showKiosk`,
     `Edit` when `showEdit` (same hrefs as today's cells).
2. **`staff-event-list.tsx`** — add `const [search, setSearch] = useState("")`,
   render `TableSearch value={search} onChange={setSearch}` between the header
   row and the tabs, and replace the tab buttons with
   `FilterTabs tabs={TABS} active={activeTab} onChange={setActiveTab} counts={tabCounts}`.
   `useEventList` already owns the debounce (sheet 04); the page only holds
   the input value. Keep the Create Event button.
3. **`assigned-event-list.tsx`** — same as step 2 without the Create button;
   `TABS` stays its two-tab list.
4. **Tests**
   - `test/event-table.test.tsx` — update the action tests: rows no longer
     contain Open/Kiosk/Edit links. Assert clicking a row opens the drawer,
     the drawer shows the right links for `showKiosk`/`showEdit`, and the
     Title link navigates without opening the drawer. Keep the attendee-count
     and empty-state tests.
   - `test/staff-event-list.test.tsx` / `test/assigned-event-list.test.tsx` —
     update to the `FilterTabs` markup and assert the search input renders and
     typing it drives the fetch (the URL carries `search=` after the debounce;
     use fake timers).
5. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "Open|Kiosk|Edit" src/modules/events/components/event-table.tsx` finds
  them only inside the drawer.
- Manually in `pnpm dev`: clicking a row opens the drawer; the Title still
  navigates; searching narrows the list server-side.

## Risks

- Row click vs link click: the stopPropagation on the Title link must be in
  place or every Title click also opens the drawer.
- The drawer is controlled by `selected`; after the kiosk or edit navigation
  (a `Link` in the footer) the row state stays — acceptable, since the page
  unmounts on navigation.
