# 02 — Top navbar: selected underline, flush at the bar's bottom edge

## Goal

A selected top-bar entry shows a brand underline sitting flush with the navbar's bottom edge, on top of its existing brand text colour. Idle links sit lighter than the foreground so hovering a non-selected entry darkens the text unmistakably — and the selected entry never changes colour on hover. No fill or line appears on hover, and no fill is used anywhere.

## Where

`src/modules/shell/components/top-navbar.tsx`, the `nav` element and the `Link` inside `navItems.map` (around lines 46-78).

## Why

The selected link was told apart only by font weight plus brand colour — colour alone cannot be relied on across a bar that also carries plain-text SIGN IN, and hover had no affordance beyond a muted → foreground shift that was too small to notice. The underline is a structural (not colour-only) marker for the current page. Hover reads clearly because idle links are kept lighter and jump to the full foreground, while blue is reserved purely for the selected entry and survives hovering it.

## Steps

1. **Let the nav fill the bar's height** so the underline can sit at the bar's bottom edge. Change the `<nav>` opening tag:

   ```tsx
   <nav className="flex items-center gap-2" aria-label="Primary navigation">
   ```

   to

   ```tsx
   <nav className="flex h-full items-stretch gap-2" aria-label="Primary navigation">
   ```

   The parent `div` is `h-16`, so the nav is 64px tall and each stretched link reaches the header's bottom border. The icon and label stay vertically centred by the link's own `items-center`.

2. **Add the underline pseudo-element and the hover colouring.** Change the `Link`'s `className` (currently lines 68-71):

   ```tsx
   className={cn(
     "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:text-brand",
     isActive ? "font-semibold text-brand" : "font-medium text-muted-fg",
   )}
   ```

   to

   ```tsx
   className={cn(
     "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
     "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0",
     isActive ? "font-semibold text-brand after:opacity-100" : "font-medium text-muted-fg/80 hover:text-fg",
   )}
   ```

   The four state rules, in one place:

   - **Idle** (`text-muted-fg/80`): links sit visibly lighter than the foreground, so any movement toward the foreground reads clearly.
   - **Hover, non-selected only** (`hover:text-fg`): the text jumps to the full foreground — the darkest the palette has — and no underline is previewed. The hover class lives _only_ in the non-active branch, so the selected link carries no hover rule at all.
   - **Selected** (`text-brand` + `after:opacity-100`): brand text plus a brand underline at `bottom-0`, which is the header's bottom edge now that links stretch. It is the only place blue appears.
   - **Selected + hover**: unchanged — because the active branch has no `hover:*` classes, hovering it leaves the blue text and underline exactly as they are.

   The underline geometry: `after:inset-x-3` matches the link's `px-3` padding so the underline runs the content width; `after:h-0.5 after:rounded-full` is a 2px pill; it is hidden by default (`after:opacity-0`) and shown only when active.

3. **Update the stale rationale comment** above the `Link` (lines 54-60) — it documents the old bare-text design. Rewrite it to say: idle links sit lighter than the foreground and hover jumps them to full `fg`, selected stays blue on hover (`aria-current` and the heavier weight state it outright without colour alone), and `rounded-md` remains only to shape the focus ring.

## Do not

- Do not put any `hover:*` class on the active link; the selected entry must not change on hover.
- Do not add a `border-*` class to the links; the underline is the `after` pseudo-element, so neither `border` nor any `bg-*` fill appears on the link itself.
- Do not use blue anywhere except the selected entry (no blue on hover, no blue tint on idle).
- Do not change SIGN IN or the profile menu.
- Do not touch `minimal` rendering — it renders no nav.

## Definition of done

- Selected entry: brand text, `font-semibold`, brand underline flush with the header's bottom border — and unchanged when hovered.
- Idle entry: lighter than the foreground (`text-muted-fg/80`).
- Hovering a non-selected entry: text jumps to full `text-fg`; no underline, no fill.
- No entry has a background fill or a `border` class.
- The underline uses the `brand` token (same hex in light and dark).
- Idle `text-muted-fg/80` stays legible (≈4.6:1 against `bg-surface`), so the lighter idle is not an accessibility regression.

## Verify

In `pnpm dev`: on `/`, Home is selected — brand text plus an underline flush at the bar's bottom edge, and hovering it changes nothing. Hover Events/Community/Tickets: the text darkens to near-black with no underline. Move away: each link relaxes to lighter idle grey. Tab to a link — the focus ring still shows and the nav still stretches. Repeat as an attendee on `/events`.
