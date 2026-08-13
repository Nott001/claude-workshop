# Speaker route rename — run spec

Each file in this directory is one spec sheet. They are **run sequentially**, in
filename order: `01` must be complete and verified before `02` starts, and so on.

Every sheet has the same shape: goal, run order, files touched, prerequisites,
steps, verification (definition of done) and risks. Do not skip the verification
section of a sheet — the next sheet depends on it.

This series renames the speaker routes so they match the staff pattern:
`/speaker/dashboard` becomes `/speaker/events` (behaviourally the same page as
`/staff/events/assigned`), and the detail route `/speaker/event/[eventId]`
becomes `/speaker/events/[eventId]`. The nav label "Dashboard" becomes
"My Events" to match the facilitator nav.

| #   | Sheet                                                     | What it produces                                  |
| --- | --------------------------------------------------------- | ------------------------------------------------- |
| 01  | [`01-route-directory-move`](01-route-directory-move.md)   | Route files moved; empty `speaker/event/` removed |
| 02  | [`02-role-home`](02-role-home.md)                         | `role-home.ts` speaker → `/speaker/events`        |
| 03  | [`03-nav-items`](03-nav-items.md)                         | Speaker nav "My Events" → `/speaker/events`       |
| 04  | [`04-event-list-hrefs`](04-event-list-hrefs.md)           | `speaker-event-list` detail links updated         |
| 05  | [`05-event-detail-hrefs`](05-event-detail-hrefs.md)       | `speaker-event-detail` back/course links updated  |
| 06  | [`06-course-and-room-links`](06-course-and-room-links.md) | Course page + room exit links updated             |
| 07  | [`07-test-updates`](07-test-updates.md)                   | All route/label assertions green                  |
| 08  | [`08-changelog-and-gates`](08-changelog-and-gates.md)     | CHANGELOG entry, gates green, commit on branch    |

The old `/speaker/dashboard` URL is not redirected after this rename; it 404s
for a signed-in user. Bookmarked links to it are out of scope.
