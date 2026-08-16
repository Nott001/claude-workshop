# 03 — Staff side rail: right-hand line instead of the fill pill

## Goal

Replace the active item's `bg-brand/10` fill in the staff rail with a full-height, square-ended brand line flush with the rail's outside (right) border. Hovering a non-selected item darkens its text to the full foreground without a line, and the selected item stays blue on hover. Blue appears only on the selected item.

## Where

`src/modules/shell/components/navbar.tsx`, the `aside` and the `Link` inside `navItems.map` (around lines 22-44).

## Why

The rail sits on the left edge of the screen, so a filled pill under the active item reads as a second bar floating in the rail; the line on the right edge — next to the label once expanded — is the conventional rail active marker (Slack/LinkedIn). The line is positioned `right-0` against each link, so the links must span the full rail width for it to land on the navbar's _outside_ edge; the rail's symmetric horizontal padding is therefore dropped on the right.

The rail collapses to icons only, so hover could not lean on a line (there is no label to line up under); instead it uses a clear text darkening, and blue stays reserved for the selected entry and survives hovering it.

## Steps

1. **Let links reach the rail's right border.** Change the `<aside>` (currently ~line 22), replacing its symmetric `px-3` with left-only padding:

   ```tsx
   <aside className="group fixed bottom-0 left-0 top-16 z-10 hidden w-[72px] flex-col overflow-hidden border-r border-border bg-surface py-5 pl-3 transition-[width] duration-300 hover:w-[202px] has-[:focus-visible]:w-[202px] lg:flex">
   ```

   The icon column keeps its 12px left inset (aside `pl-3` + link `px-3`), and each `w-full` link now ends at the rail's border, so `right-0` puts the line flush with the navbar's outside edge.

2. **Swap the fill for the right-hand line and set the hover colouring.** Change the `Link`'s `className` (currently lines 39-42):

   ```tsx
   className={cn(
     "flex w-full items-center overflow-hidden rounded-md px-3 py-3.5 text-sm font-medium text-nowrap transition hover:bg-muted hover:text-fg",
     isActive ? "bg-brand/10 text-brand" : "text-muted-fg",
   )}
   ```

   to

   ```tsx
   className={cn(
     "relative flex w-full items-center rounded-md px-3 py-3.5 text-sm font-medium text-nowrap transition",
     "after:absolute after:inset-y-0 after:right-0 after:w-[3px] after:bg-brand after:opacity-0",
     isActive ? "text-brand after:opacity-100" : "text-muted-fg/80 hover:text-fg",
   )}
   ```

   What changed and why:

   - `hover:bg-muted` + `hover:text-fg` are gone. Hover is `hover:text-fg` only, and — like the top bar — it lives _only_ in the non-active branch, so the active item carries no hover rule and stays blue when hovered.
   - The active `bg-brand/10` fill is gone; the active item is `text-brand` plus the full-strength line (`after:opacity-100`), the only blue on the rail.
   - `relative` anchors the `after` line; `after:inset-y-0 after:right-0` makes it the full item height on the right edge.
   - `overflow-hidden` is removed from the link. Its rounded-corners clip (via `rounded-md`) was shearing the top and bottom of the full-height line into the corner radius — the "rounding" on the line. The label hides itself via its own `max-w-0 overflow-hidden` span, and the `aside` still clips the rail's own overflow, so nothing regresses.
   - Idle links are `text-muted-fg/80` so the hover jump to `text-fg` is clearly visible, matching the top bar.
   - The prefetch comment above the link is unchanged and must stay.

3. Leave everything else — the collapsed/expanded width logic on the `<aside>`, the fixed-width icon box, and the `group-hover:` label reveal — untouched.

## Do not

- Do not reintroduce `bg-brand/10`, `hover:bg-muted`, or any `hover:*` class on the active link.
- Do not put a `rounded-*` class on the line or restore `overflow-hidden` to the link (that is the shearing the fix removes).
- Do not change the collapse behaviour or the label transition classes; the line must be visible when the rail is collapsed (it is the only active marker in that state).
- Do not use blue for hover or idle; only the selected item is blue.

## Definition of done

- Active item: `text-brand` plus a full-height, square 3px brand line flush with the rail's outside border; no background fill; colour unchanged on hover.
- Idle item: `text-muted-fg/80`.
- Hovering a non-selected item: text jumps to `text-fg`; no line; no fill.
- The line is present when the rail is collapsed (icon-only) and when expanded next to the label.

## Verify

In `pnpm dev` as an admin on `/staff/events`: the Events item carries a full-height, square brand line flush with the rail's right border and no fill; hovering it changes nothing. Hover Community — the text darkens to near-black, no line, no grey fill. Collapse the viewport below `lg` and return — the rail and line still behave. Tab through — `:focus-visible` still expands the rail and the focus ring renders.
