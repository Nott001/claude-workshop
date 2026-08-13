# 01. Move the speaker route files

## Goal

Rename the speaker route tree from `/speaker/dashboard` and
`/speaker/event/[eventId]` to `/speaker/events` and
`/speaker/events/[eventId]`, so the list and detail URLs match the staff
pattern (`/staff/events` + `/staff/events/[id]`). This sheet only moves files;
no references are updated yet, so the tree is intentionally broken until sheet
`02`.

## Run order

First. Every later sheet edits files that this one moves.

## Files touched

- `src/app/speaker/dashboard/page.tsx` → `src/app/speaker/events/page.tsx`
- `src/app/speaker/event/[eventId]/page.tsx` → `src/app/speaker/events/[eventId]/page.tsx`
- `src/app/speaker/event/[eventId]/course/page.tsx` → `src/app/speaker/events/[eventId]/course/page.tsx`
- The now-empty `src/app/speaker/event/` directory is removed.

## Prerequisites

- Working tree clean, on branch `speaker-events-route`, created before this sheet.

## Steps

1. Create the branch:

   ```bash
   git switch -c speaker-events-route
   ```

2. Move the list page, preserving history:

   ```bash
   git mv src/app/speaker/dashboard/page.tsx src/app/speaker/events/page.tsx
   ```

3. Move the detail and course pages together:

   ```bash
   git mv "src/app/speaker/event/[eventId]" "src/app/speaker/events/[eventId]"
   ```

4. Remove the emptied directory:

   ```bash
   rmdir src/app/speaker/event
   ```

5. Confirm the new tree and that nothing else lives under `speaker/`:

   ```bash
   find src/app/speaker -type f
   ```

   Expected result: `events/page.tsx`, `events/[eventId]/page.tsx`,
   `events/[eventId]/course/page.tsx`.

## Verification

- `git mv` reported no errors; the empty `speaker/event/` directory is gone.
- `git status` shows only renames (status `R`), no content changes.

## Risks / notes

- The route rename is a breaking URL change. There is **no redirect** from the
  old paths (decision recorded in `do-not-commit/plan.md` follow-up); old
  bookmarks 404 for a signed-in user, which is accepted.
- Sheets `02`–`06` must run before the app is usable again — do not commit or
  run the dev server between here and sheet `06` expecting the speaker flow to
  work.
