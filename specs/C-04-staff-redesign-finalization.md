# C-04 Staff redesign finalization

Last step of the staff-page redesign. No new features: sweep for leftovers from
the card-era UI, add the changelog entry, and run every gate the way CI does.

Depends on C-01, C-02 and C-03 all landing.

## Sweep

- Grep the staff pages for `EventCard` and `SectionCard` usage; every staff-side
  reference must be gone or justified. The user-facing `/events` grid keeps
  `EventCard` — staff-only code must not.
- `src/modules/events/pages/staff-event-list.tsx` — confirm it no longer imports
  `EventCard`, `cn`, or `FilterTab`-driven card markup it no longer uses.
- Confirm the removed "facilitator floor" comment on the cover-image upload is
  gone (C-03 removed its call site).
- `useEventList` — if the admin page is now its only caller, drop any
  facilitator-specific branches that became dead (e.g. `isFacilitator`),
  keeping the shared pagination/tab behavior. Do not reach into the new
  `use-assigned-events` hook's behaviour.
- Verify no route still guards a staff page at facilitator floor when it renders
  admin-only content.

## Changelog

Add one `CHANGELOG.md` entry describing the user-visible change: staff events
now render as a table, facilitators get a dedicated assigned-events page with a
Completed tab, the staff event detail page is tabbed, and event editing, cover
images, and surveys are admin-only.

## Verification

Run the complete gate set exactly as CI does:

- `pnpm format` and `pnpm format:check`
- `pnpm lint` (respects `--max-warnings=16`)
- `pnpm typecheck`
- `pnpm test` (vitest, once, non-watch)
- `pnpm test:e2e` for the touched flows if the Playwright suite covers staff
  event navigation.

Then a manual pass in `pnpm dev`:

- As admin: `/staff/events` shows the table with Upcoming/Completed/Drafts, an
  event's page shows all six tabs, and the Edit link lands on Event Details.
- As facilitator: the navbar shows "My Events"; the assigned page shows draft and
  active events under Upcoming and finished ones under Completed; an event's
  page shows only Overview/Course/Kiosk with no Publish/Delete/survey controls.

No schema, migration, or platform-primitive work is part of this redesign, so
`pnpm cf:preview` is not required; if the run touches any route that streams or
holds a socket, run it anyway before merging.

## Not in scope

- Any remaining cards on user-facing pages.
- Post-redesign polish (sorting, filtering, search on the tables).
