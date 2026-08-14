# 02. Shared table toolbar and pagination

## Goal

Ships the search, filter and pagination controls every migrated table reuses,
so none of the duplicated markup (the pill tabs in kiosk/admin-attendee, the
prev/next blocks in kiosk/admin-attendee/audit-logs) survives migration.

## Run order

Second. Depends on sheet 01 (`Table` primitives exist, `cn`, `Button`).

## Files touched

- Create `src/shared/components/table-toolbar.tsx` — exports `TableSearch`,
  `FilterTabs`
- Create `src/shared/components/table-pagination.tsx` — exports `Pagination`
- Create `test/table-toolbar.test.tsx`
- Create `test/table-pagination.test.tsx`

## Prerequisites

- Sheet 01 complete and verified.

## Steps

1. **`TableSearch`** in `table-toolbar.tsx`. A controlled search `Input`
   (reuse `@/shared/components/input`) with a leading `search` material icon
   and a clear (`close`) button that appears only while there is text. Props:
   `value`, `onChange(value: string)`, `placeholder?`. It must not debounce
   itself — debouncing is the caller's hook (sheets 04, 05, 07 add it), so the
   component stays a dumb input and the debounce lives in one testable place.
   Match the `h-9 text-xs` compact sizing the current tables use.
2. **`FilterTabs`** in `table-toolbar.tsx`. Props:
   `tabs: { key: string; label: string }[]`, `active`, `onChange(key)`,
   `counts?: Record<string, number>`. Renders the pill tabs today's tables
   hand-roll: active `bg-brand/10 text-brand`, inactive `bg-muted
text-muted-fg hover:bg-muted`. When `counts` is provided, render the count
   inside the label as `(N)`.
3. **`Pagination`** in `table-pagination.tsx`. Props:
   `page`, `pageSize`, `total`, `onPageChange`. Renders the range text
   `X–Y of Z` and Prev/Next `Button`s (variant `secondary`, size `sm`),
   disabled at the ends. Used by the page-based lists (kiosk, admin attendees,
   audit logs); `LoadMoreButton` stays for append-style lists.
4. Write tests in `test/table-toolbar.test.tsx` and
   `test/table-pagination.test.tsx`:
   - `TableSearch` forwards changes, shows the clear button only with text,
     and clearing empties the value.
   - `FilterTabs` marks the active tab, calls `onChange` on click, and renders
     counts when given.
   - `Pagination` renders the correct range for page 1 of 34 over 15/page,
     disables Prev on page 1, disables Next on the last page, and calls
     `onPageChange` with the next/previous page.
5. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.

## Risks

- Keeping debounce out of `TableSearch` is deliberate: two components each
  debouncing would drift. The caller-side debounce hook arrives in sheets
  04/05/07 and is covered there.
