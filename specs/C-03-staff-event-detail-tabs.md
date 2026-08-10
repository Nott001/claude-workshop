# C-03 Staff event detail as tabs

Third step of the staff-page redesign. The staff event detail page stops
displaying each event service as a stacked card and becomes a tabbed page. It
should look like an admin page: minimal, functional, no user-facing gloss.

Tabs a role cannot use are **hidden, not disabled** — a facilitator never sees a
Speakers or Surveys tab at all.

Depends on C-01 (facilitators have no event-edit/survey powers server-side) and
C-02 (the list links here; admin "Edit" links use `?tab=details`).

## Tab set

Rewrite `src/modules/events/pages/staff-event-detail.tsx` (route
`src/app/staff/events/[id]/page.tsx`). Replace the `SectionCard` grid with a
single tab bar and one active panel, driven by local state seeded from the
`tab` query param (so the C-02 "Edit" link lands on the details tab):

- **Overview** (default) — read-only event facts (status badge, title,
  date/time, venue, price, description, attendee count) plus the action buttons:
  Publish (admin, drafts only), Enter Course Room (facilitator+, when a course
  exists), Delete (admin). The page header (back link, badge, title, date/time)
  stays above the tab bar for all tabs.
- **Event Details** — admin only. The existing `EditEventForm` embedded plus the
  `CoverImageUpload` from the removed Cover image card.
- **Course** — facilitator+. Existing `CourseSection`, unchanged export and
  behaviour: read-only summary once a course exists, the builder for an admin or
  an **assigned** facilitator (course management stays with them per C-01).
- **Kiosk** — facilitator+. Existing `KioskSection` (button to
  `/staff/events/[id]/kiosk`).
- **Speakers** — admin only. Existing `SpeakersSection`.
- **Surveys** — admin only. Existing `SurveysSection`.

Facilitator tab set: Overview, Course, Kiosk. Admin/super_admin tab set: all
six.

## Section gating changes

- `OverviewSection` — its actions are currently gated on `isStaff`
  (facilitator floor), so facilitators see Publish and Delete buttons the server
  now refuses. Gate Publish and Delete on admin; keep Enter Course Room on
  facilitator+.
- `CoverImageSection` — delete the standalone card; the upload moves into the
  Event Details tab (admin-only surface).
- `SpeakersSection` — already admin-only; unchanged.
- `SurveysSection` — raise its own `hasMinRole(userRole, ROLES.FACILITATOR)`
  floor to `ROLES.ADMIN`. Its `canManage` prop is now always true for its
  audience; drop the prop or hardcode it true, and delete the now-dead
  "assigned facilitator" toggle/send logic.
- `KioskSection`, `CourseSection` — unchanged apart from where they render.

## Edit form embedding

`src/modules/events/components/edit-event-form.tsx` gains a `backHref` prop
(defaulting to the current `/events/[id]` so the standalone
`/staff/events/[id]/edit` route keeps working). The Event Details tab passes
`backHref={`/staff/events/${eventId}`}` and `initialData={event}` (the full row
from `useEventDetail`; `toFormValues` widens it). After a save, navigate back to
the staff detail page instead of `/events/[id]` (which would bounce an admin
through the attendee-view redirect).

## Tests

- New `test/staff-event-detail-tabs.test.tsx`: with an admin, all six tabs
  render and switching shows each panel (mock the data hooks: `useEventDetail`,
  `useEventSpeakers`, `useCourseByEvent`, `useCourseCreate`, `useSurveyStatus`);
  with a facilitator, only Overview / Course / Kiosk render and Speakers,
  Surveys, Event Details are absent. Assert on the visible action buttons too:
  a facilitator sees no Publish/Delete, an admin does.
- Update `test/staff-course-section.test.tsx` only if `CourseSection`'s export
  or props changed (they should not have).
- Update `test/cover-image-upload.test.tsx` if it asserted the card location.
- `test/event-form.test.tsx` and the `EditEventForm` backHref default keep the
  standalone edit route covered.

## Not in scope

- The `/staff/events/[id]/speakers` standalone page (unlinked, admin content):
  left as-is.
- Kiosk page itself (`/staff/events/[id]/kiosk`) and the check-in API.
- The user-facing `/events/[id]` page.

## Gate

`pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass. The admin
`?tab=details` link from C-02 now resolves to a real tab.
