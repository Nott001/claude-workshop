# 01. Shared table primitives

## Goal

Land the visual vocabulary every staff table will share. `table.tsx` exports
thin presentational primitives — `Table`, `TableHead`, `TableBody`, `TableRow`,
`TableHeadCell`, `TableCell`, `TableEmpty`, `TableContainer` — with the one
unified look decided in the README. No consumer is migrated yet; this sheet
only ships the primitives and proves they render.

## Run order

First. Every later sheet imports from these files.

## Files touched

- Create `src/shared/components/table.tsx`
- Create `test/table-primitives.test.tsx`

## Prerequisites

- Working tree clean, on branch `feat/unify-tables`, created in this sheet.

## Steps

1. `git switch -c feat/unify-tables`.
2. Write `src/shared/components/table.tsx` following the existing thin-wrapper
   pattern (`button.tsx`, `badge.tsx`): `cn` for class merging, no logic worth
   testing beyond rendering.
   - `Table` — `<table className="w-full text-left text-sm">`.
   - `TableHead` — `<thead>` (no styling; the header row owns it).
   - `TableBody` — `<tbody className="divide-y divide-border">`.
   - `TableHeadCell` — `<th>` with `px-5 py-3 font-semibold text-muted-fg`.
   - `TableCell` — `<td>` with `px-5 py-4`.
   - `TableRow` — `<tr>`; optional `onClick` and `aria-label`. When `onClick`
     is present it adds `cursor-pointer transition-colors hover:bg-muted`,
     wires `onClick` and a keyboard handler (Enter/Space on a focused row
     triggers it), and sets `tabIndex={0}`. Rows without `onClick` stay
     non-interactive.
   - `TableEmpty` — `{ icon?: string; title: string; hint?: string }` rendering
     the icon, title and optional hint block that the kiosk and admin-attendee
     empty states each hand-rolled today (`rounded-lg border border-border
bg-muted px-4 py-8 text-center`).
   - `TableContainer` — `<div className="overflow-hidden rounded-xl border
border-border bg-surface shadow-sm">`.
3. Write `test/table-primitives.test.tsx`. Assert **behavior**, not type
   shapes (AGENTS.md): render each primitive and assert on what the user sees —
   the header cell text, a row's cell text, the empty state's title/hint, and
   that a clickable row calls `onClick` on mouse click and on Enter.
4. If the new components are uncovered by existing tests, raise the coverage
   thresholds in `vitest.config.ts` by whatever this sheet's tests add; never
   lower them.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "<table" src/shared/components` shows only `table.tsx`.

## Risks

- Keyboard activation of rows is easy to get wrong; the test asserting Enter
  activates the row guards it. Rows must only appear focusable when they are
  actually clickable.
