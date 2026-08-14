# 03. Shared Drawer

## Goal

A right-side drawer every migrated table opens on row click. Base UI ships no
drawer primitive, so this is a `Dialog` popup positioned flush against the
right edge — the same headless layer the existing `dialog.tsx` wraps, with the
same backdrop, focus trap, escape-to-close and scroll lock for free.

## Run order

Third. Depends on sheet 01 (component conventions).

## Files touched

- Create `src/shared/components/drawer.tsx` — exports `Drawer`
- Create `test/drawer.test.tsx`

## Prerequisites

- Sheet 02 complete and verified.

## Steps

1. Write `src/shared/components/drawer.tsx` over
   `@base-ui/react/dialog` (mirror the parts `dialog.tsx` already wires —
   `Root`, `Portal`, `Backdrop`, `Popup`, `Title`, `Close`).
   Props: `open`, `onOpenChange`, `title`, `description?`, `children`,
   `footer?`.
   - `Popup`: `fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col
bg-surface shadow-xl outline-none` with a `border-l border-border`, so it
     reads as a sheet, not a modal.
   - `Backdrop`: `fixed inset-0 z-50 bg-overlay` (same as `DialogOverlay`).
   - Header: `title` (bold) plus an `description?` line below, and the
     existing close-button treatment (`ghost` icon `Button`, `close` glyph,
     `sr-only` label).
   - Body: `flex-1 overflow-y-auto px-4` holding `children`.
   - `footer?`: a `px-4 py-3 border-t border-border` slot for action buttons
     (the migrated admin-attendee actions land here).
2. Write `test/drawer.test.tsx`. Assert behavior:
   - renders title/description/children when `open`.
   - backdrop click or Escape closes via `onOpenChange(false)`.
   - stays mounted-hidden when `open` is false (assert no content).
3. Raise `vitest.config.ts` thresholds by whatever these tests add.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes with coverage at or above the pre-sheet thresholds.
- `pnpm lint` and `pnpm format` pass.
- `rg "fixed inset-y-0 right-0" src/shared/components/drawer.tsx` finds the
  drawer's single positioning statement.

## Risks

- A drawer opened from a table inside the staff shell must render above the
  shell's own overlay/z-index; `z-50` on both popup and backdrop matches the
  existing dialog stack.
- Escape-to-close comes from Base UI's dialog behaviour and is asserted in the
  test, not assumed.
