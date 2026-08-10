# C-02 Staff events list as a table

Second step of the staff-page redesign. Staff must not see what attendees see:
the event list on the staff side becomes a **tabular list**, not cards. The
facilitator dashboard is split into a dedicated page that shows only the events
they are assigned to.

Depends on C-01 (the server now refuses facilitator event edits), so the list
page no longer offers them editing affordances.

## Navbar

`src/modules/shell/components/navbar.tsx` — the facilitator nav item changes
from `Events → /staff/events` to **`My Events → /staff/events/assigned`**
(same icon). Admin and super_admin keep `Events → /staff/events`. This is the
"dedicated entry" the spec calls for: facilitators reach their assigned events
from a page of their own, not the general listing.

## Shared table component

New `src/modules/events/components/event-table.tsx`: a minimal, admin-style
table replacing the `EventCard` grid on staff pages. Row link target and the
action column are driven by props so both pages reuse it.

- Columns: Title (link to `/staff/events/[id]`), Date, Time, Venue, Status
  (`EventStatusBadge`), Attendees, Actions.
- Title cell uses `formatEventDate` / `formatTime` from `@/shared/lib/date-utils`.
- Actions:
  - Always: **Open** → `/staff/events/[id]`.
  - Facilitators: **Kiosk** → `/staff/events/[id]/kiosk`.
  - Admins: **Edit** → `/staff/events/[id]?tab=details` (the detail page in C-03
    reads the `tab` query param; for now the link is placed and verified by test
    only — see C-03 for the reading side).
- Empty state renders the existing "No events found." message.
- No card chrome: no cover image, no gradient, no hover scale.

## Attendee counts on the list

The list API returns no attendee counts today. Add one grouped query so the
table's Attendees column is real data, not a placeholder:

- New `event.dao` function `getAttendeeCounts(supabase, eventIds)` returning
  `Record<number, number>` from a single `TICKET` select grouped by `event_id`
  (`status != 'cancelled'`), matching the definition of `getAttendeeCount`.
- `listEvents` (in `src/modules/events/lib/event-crud.ts`) joins those counts
  onto the rows it returns so the client needs no second fetch. The service
  client bypasses RLS, so no grant work is required.

## Admin page — `/staff/events`

`src/modules/events/pages/staff-event-list.tsx` (route `src/app/staff/events/page.tsx`):

- Guard raised from `useRoleGuard(ROLES.FACILITATOR)` to
  `useRoleGuard(ROLES.ADMIN)`; a facilitator hitting the URL is sent to
  `/staff/events/assigned` instead of rendering nothing.
- Reuses `useEventList` (admins get every event from `/api/events`, including
  drafts). Tabs become **Upcoming / Completed / Drafts** — the current admin
  tab set omits Drafts, which hides events an admin creates and must publish.
- Renders `<EventTable>` with admin actions instead of the `EventCard` grid.
- Keeps the LoadMore pagination from `useEventList`.

## Assigned page — `/staff/events/assigned`

New route `src/app/staff/events/assigned/page.tsx` re-exporting a new
`src/modules/events/pages/assigned-event-list.tsx` (client):

- Guard: `useRoleGuard(ROLES.FACILITATOR)`; a non-facilitator (admin+) is sent
  to `/staff/events`. The server already scopes `/api/events` to the
  facilitator's `EVENT_FACILITATOR` rows, so no new filter is added — the page
  simply must not leak the general listing.
- New hook `src/modules/events/lib/use-assigned-events.ts` mirroring
  `useEventList` (paged fetch of `/api/events`, LoadMore) with two tabs instead
  of three:
  - **Upcoming** — status `draft` **or** `active`. Facilitators see assigned
    events regardless of whether they are published or still drafts.
  - **Completed** — status `complete`. A finished event lands in its own tab
    rather than vanishing from the list.
- Tab counts next to each label, same as the admin page.
- Renders `<EventTable>` with facilitator actions (Open + Kiosk).

## Tests

- New `test/event-table.test.tsx`: renders rows from real event rows (Title,
  date, venue, status), links the title to `/staff/events/<id>`, and shows the
  role-appropriate action links (Kiosk for facilitator, Edit for admin).
- New `test/assigned-event-list.test.tsx`: a facilitator sees only their
  assigned rows; the Upcoming tab shows both `draft` and `active` events and the
  Completed tab shows `complete`; LoadMore still works.
- Update `test/api-events.test.ts` list assertions if the response shape now
  carries `attendee_count`.
- Update `test/navbar-role-nav.test.tsx`: the facilitator nav item is now
  `My Events → /staff/events/assigned`.
- New DAO test for `getAttendeeCounts` (grouped count, cancelled tickets
  excluded, empty id set returns `{}`).

## Not in scope

- The staff event **detail** page (C-03) — this spec only links to it.
- Server-side filtering changes: the assigned-only behavior already lives in
  `event.dao.list`.
- Sorting or server-side pagination.

## Gate

`pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass. The admin
page links to `?tab=details`, which is inert until C-03 lands; that is fine.
