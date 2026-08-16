# 01 — Branch and baseline

## Goal

Work off a clean, short-lived branch and confirm the app runs before touching any code.

## Steps

1. Create the branch for the whole effort:

   ```sh
   git checkout -b feat/navbar-selection-design
   ```

2. Confirm the working tree is clean:

   ```sh
   git status
   ```

3. Start the dev server and let it hot-reload for the following sheets:

   ```sh
   pnpm dev
   ```

   Visit `/` (guest/attendee top bar) and `/staff/events` (admin side rail). Both render with the current design: the top bar's selected link is bare brand text with no underline, and the admin rail's selected item is a `bg-brand/10` fill pill.

4. Read the two files on the chopping block so the edits later stay small and single-purpose:

   - `src/modules/shell/components/top-navbar.tsx`
   - `src/modules/shell/components/navbar.tsx`

## Definition of done

- On branch `feat/navbar-selection-design`.
- `pnpm dev` is up and both the top bar and the staff rail are visually checkable.
- No product code changed in this sheet.
