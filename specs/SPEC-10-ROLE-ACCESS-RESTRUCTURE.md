# SPEC-10 — Role Access Restructure

Status: draft
Scope: re-align page-level and API-level access for each role in preparation for
event-scoped facilitators and coordinator-level admins.

## 1. Role definition

Each user holds exactly one `user_role` in the `USER` table. The numeric levels
in `shared/lib/role-hierarchy.ts` define a cumulative hierarchy — a role
inherits all permissions of any role with a lower level.

| Level | Role        | Inherits from                         |
| ----: | ----------- | ------------------------------------- |
|    10 | attendee    | —                                     |
|    20 | speaker     | attendee                              |
|    30 | facilitator | attendee, speaker                     |
|    40 | admin       | attendee, speaker, facilitator        |
|    50 | super_admin | attendee, speaker, facilitator, admin |

This spec **does not** change the hierarchy constants. It changes what each
role is allowed to reach — pages and APIs — _given_ those levels.

## 2. Role map — what each role does

These are the intended responsibilities the access model enforces:

### Attendee (10)

- Browse public events.
- Register for events and buy tickets.
- View own tickets and payments.
- Enter the event room (with a valid ticket).
- Request support.
- Edit own profile.

### Speaker (20)

Everything attendee does, plus:

- View own speaker dashboard — list of events they are assigned to.
- Enter their assigned event's room without a ticket (speaker assignment acts as implicit access).
- Answer Q&A and highlight lessons during a live session.
- Create and manage their course (modules, lessons, curriculum) through their own
  `/speaker/*` pages — **not** through `/staff/*`.

**No `/staff/*` page access at all.** The speaker lives entirely under
`/speaker/*`.

### Facilitator (30)

- Manage a single event's day-of operations:
  - View event detail.
  - Edit event metadata (title, date, venue).
  - Publish and delete the event.
  - Operate the kiosk (QR check-in).
  - Monitor and reply to event-level support chat.
  - Send surveys.
- View the staff events listing (in the future, this should filter to their
  assigned events via an `EVENT_FACILITATOR` join table).

**No global/administrative access.** No create-event, no org management, no
email logs, no audit logs, no global support dashboard, no course audit.

### Admin (40)

Everything facilitator does, plus:

- Create new events.
- View and manage the organisation (staff members) — invite, promote, remove,
  except promoting to `admin` (super_admin only).
- View all courses (audit view).
- View email logs.
- View audit logs.
- View and reply to the global support dashboard (all conversations).

Admin is the **coordinator** role — the person who runs the platform day to
day.

### Super Admin (50)

Everything admin does, plus:

- Invite and promote users to `admin`.
- Delete any resource.

---

## 3. Page access matrix

| Page                              | attendee  |   speaker   | facilitator |   admin   | super_admin |
| --------------------------------- | :-------: | :---------: | :---------: | :-------: | :---------: |
| `/` (landing)                     |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/sign-in`, `/sign-up`            |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/home`                           |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/events` (public)                |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/events/[id]`                    |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/events/[id]/register`           |     ✓     |      ✗      |      ✗      |     ✗     |      ✗      |
| `/events/[id]/room`               | ✓(ticket) | ✓(assigned) |  ✓(bypass)  | ✓(bypass) |  ✓(bypass)  |
| `/tickets`                        |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/payments`                       |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/user/[[...rest]]`               |     ✓     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/speaker/dashboard`              |     ✗     |      ✓      |      ✓      |     ✓     |      ✓      |
| `/speaker/event/[eventId]`        |     ✗     | ✓(assigned) |      ✓      |     ✓     |      ✓      |
| `/speaker/event/[eventId]/room`   |     ✗     | ✓(assigned) |      ✓      |     ✓     |      ✓      |
| `/speaker/event/[eventId]/course` |     ✗     | ✓(assigned) |      ✓      |     ✓     |      ✓      |
| `/staff/events`                   |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/[id]`              |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/[id]/edit`         |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/[id]/room`         |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/[id]/kiosk`        |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/[id]/support`      |     ✗     |      ✗      |      ✓      |     ✓     |      ✓      |
| `/staff/events/new`               |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |
| `/staff/organization`             |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |
| `/staff/courses`                  |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |
| `/staff/emails`                   |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |
| `/staff/support` (global)         |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |
| `/staff/audit-logs`               |     ✗     |      ✗      |      ✗      |     ✓     |      ✓      |

### Post-login redirect

| Role        | Redirect to          |
| ----------- | -------------------- |
| attendee    | `/home`              |
| speaker     | `/speaker/dashboard` |
| facilitator | `/staff/events`      |
| admin       | `/staff/events`      |
| super_admin | `/staff/events`      |

### Navbar items by role

| Role        | Items                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| attendee    | Home, Events, Tickets                                                    |
| speaker     | Dashboard                                                                |
| facilitator | Events                                                                   |
| admin       | Events, Create event, Courses, Organization, Emails, Support, Audit Logs |
| super_admin | Events, Create event, Courses, Organization, Emails, Support, Audit Logs |

---

## 4. API guard matrix

| Method | Route                        | Current min role |      New min role       |
| ------ | ---------------------------- | :--------------: | :---------------------: |
| GET    | `/api/events`                |     attendee     |  attendee (unchanged)   |
| POST   | `/api/events`                | **facilitator**  |        **admin**        |
| GET    | `/api/events/[id]`           |     attendee     |  attendee (unchanged)   |
| PATCH  | `/api/events/[id]`           |   facilitator    | facilitator (unchanged) |
| DELETE | `/api/events/[id]`           |   facilitator    | facilitator (unchanged) |
| GET    | `/api/organization`          | **facilitator**  |        **admin**        |
| POST   | `/api/organization`          |      admin       |    admin (unchanged)    |
| PATCH  | `/api/organization/[userId]` |      admin       |    admin (unchanged)    |
| DELETE | `/api/organization/[userId]` |      admin       |    admin (unchanged)    |
| GET    | `/api/courses`               |      admin       |    admin (unchanged)    |
| POST   | `/api/courses`               |     speaker      |   speaker (unchanged)   |
| GET    | `/api/logs`                  | **facilitator**  |        **admin**        |
| GET    | `/api/audit-logs`            | **facilitator**  |        **admin**        |

---

## 5. Gate implementation

### 5.1 Middleware (`src/middleware.ts`)

No change. Middleware guards authentication only — any signed-in user may reach
`/staff/*`. Role gating happens at the page and API level. Rationale: the
middleware runs on every request and should stay fast (a single Supabase user
lookup). Role checks add a second query or parsing step that belongs closer to
the data.

### 5.2 Page-level guards

Every page under `/staff/*` that is restricted to a specific role MUST have an
explicit guard that renders "Access denied." or redirects when the current
user's role is insufficient. The guard must use `hasMinRole` from
`@/shared/lib/role-hierarchy` (client components) or `requireRole` from
`@/modules/auth/lib/role-guard` (server components).

| Page                         | Guard mechanism                                                                         | Behaviour on denial                        |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `/staff/events`              | client: `hasMinRole(userRole, "facilitator")`                                           | Render "Access denied."                    |
| `/staff/events/[id]`         | client: `hasMinRole(userRole, "facilitator")`                                           | Already exists at line 360-366 — unchanged |
| `/staff/events/[id]/edit`    | server: `requireRole("facilitator")`                                                    | 401 / redirect to sign-in                  |
| `/staff/events/[id]/room`    | client: `hasMinRole(userRole, "facilitator")`                                           | Redirect to `/events/[id]/room`            |
| `/staff/events/[id]/kiosk`   | client: `hasMinRole(userRole, "facilitator")`                                           | Already exists at line 21-23 — unchanged   |
| `/staff/events/[id]/support` | client: already behind `hasMinRole(userRole, "facilitator")` in parent page — unchanged |
| `/staff/events/new`          | client: `hasMinRole(userRole, "admin")`                                                 | Redirect to `/staff/events`                |
| `/staff/organization`        | client: `hasMinRole(userRole, "admin")`                                                 | Render "Access denied."                    |
| `/staff/courses`             | client: `hasMinRole(userRole, "admin")`                                                 | Already exists at line 28, 52 — unchanged  |
| `/staff/emails`              | client: `hasMinRole(userRole, "admin")`                                                 | Render "Access denied."                    |
| `/staff/support`             | server: `requireRole("admin")`                                                          | 401 / redirect to sign-in                  |
| `/staff/audit-logs`          | client: `hasMinRole(userRole, "admin")`                                                 | Render "Access denied."                    |

### 5.3 App-shell elements

| Element                 | Current rule                      | New rule                        |
| ----------------------- | --------------------------------- | ------------------------------- |
| Floating support button | Hidden for `speaker`+             | Unchanged (hidden for speaker+) |
| Footer                  | `StaffFooter` for `speaker`+      | Unchanged                       |
| Navbar items            | Keyed by role in `ROLE_NAV_ITEMS` | Per table in §3                 |

---

## 6. Speaker course page

### 6.1 Rationale

The speaker event detail page (`/speaker/event/[eventId]`) has "Manage Course"
/ "Build Course" buttons that link to `/staff/events/[eventId]`. Since speakers
no longer access `/staff/*`, this link is dead. The speaker needs their own
course management page.

### 6.2 Specification

**Route:** `GET /speaker/event/[eventId]/course`

**Guard:** The page must check:

1. The user is signed in.
2. The user's role is `speaker` or higher.
3. The user is assigned as a speaker to this event (using the existing
   `useSpeakerEvent` hook or a similar assignment check).

If any check fails, redirect to `/speaker/dashboard` (not signed in, wrong
role) or `/speaker/event/[eventId]` with an error (not assigned).

**Content:**

The page renders the same course management UI currently in
`/staff/events/[id]/page.tsx` as `CourseSection`, but as a standalone page.
Specifically:

- **No course exists yet:** Show the "Create Course" button that initialises an
  empty curriculum via `useCourseCreate`.
- **Course exists, no modules:** Show the empty `CurriculumBuilder` with an
  "Add Module" button.
- **Course exists with modules:** Show the full `CurriculumBuilder` with
  module/lesson CRUD.
- **Lesson dialog:** Same `LessonDialog` component for adding lessons.

The page should use the existing hooks (`useCourseByEvent`, `useCourseCreate`)
and components (`CurriculumBuilder`, `LessonDialog`) from
`@/modules/courses/lib/` and `@/modules/courses/ui/`.

**Layout:** Standalone page with a "Back to event" link to
`/speaker/event/[eventId]`. Uses the `Footer` component with role=`speaker`.

### 6.3 Navbar behaviour on the course page

On `/speaker/event/[eventId]/course`, the `Navbar` should still render (since
the path does not match a `HIDE_NAVBAR_PATHS` entry). The speaker's nav shows
only "Dashboard".

---

## 7. Expected page behaviour

### 7.1 `/staff/events`

A speaker who navigates here (e.g., by bookmark) sees "Access denied." instead
of the events list. Only `facilitator`+ get the events list with tabs.

The non-facilitator tabs (Upcoming, Completed) shown to speakers are now
irrelevant since speakers cannot reach the page. The `NON_FACILITATOR_TABS`
array and the `isFacilitator`/`userRole` path in the render should remain in
the hook — the page guard will prevent speakers from reaching this code.

### 7.2 `/staff/events/[id]`

Currently blocks below facilitator at line 360-366. Unchanged. Speakers no
longer reach this page via the broken link from their event detail page.

### 7.3 `/staff/events/[id]/room`

A speaker who navigates here (by typing the URL) sees a redirect to
`/events/[id]/room` (the attendee room). Previously, an assigned speaker could
access the staff room — now they must use `/speaker/event/[eventId]/room`.

The `useRoomAccess` hook's `isStaff` check (line 48, currently `speaker`+)
should remain unchanged — it also controls the highlight button in the speaker
room, which speakers should keep.

### 7.4 `/staff/events/new`

A facilitator who navigates here sees a redirect to `/staff/events`. Only
`admin`+ may create events.

The create-event API (`POST /api/events`) also moves to `admin` — a facilitator
who bypasses the page guard and calls the API directly gets a 401.

### 7.5 `/staff/organization`

A facilitator who navigates here either sees "Access denied." or the API call
to `GET /api/organization` returns 401 (causing the page to show "Loading
members..." indefinitely). Implement a page-level guard for better UX and to
avoid the hanging-loading state.

### 7.6 `/staff/emails`

Currently no page guard. Add one: `admin`+. Below admin sees "Access denied."
The underlying API (`GET /api/logs`) also moves to `admin`.

### 7.7 `/staff/audit-logs`

Currently no page guard. Add one: `admin`+. Below admin sees "Access denied."
The underlying API (`GET /api/audit-logs`) also moves to `admin`.

### 7.8 `/staff/support`

Currently a server component with `requireAuth`. Change to `requireRole("admin")`.
A facilitator who navigates here gets a 401 redirect. The event-level support
chat at `/staff/events/[id]/support` remains available to facilitators.

---

## 8. Implementation order

### Phase 1 — Guards and API changes (write-safe, no new pages)

1. Navbar: restrict facilitator and speaker items per §3.
2. `/staff/events` — add facilitator+ guard.
3. `/staff/events/new` — add admin+ guard.
4. `/staff/events/[id]/edit` — add `requireRole("facilitator")`.
5. `/staff/events/[id]/room` — add facilitator+ guard.
6. `/staff/emails` — add admin+ guard.
7. `/staff/audit-logs` — add admin+ guard.
8. `/staff/support` — change to `requireRole("admin")`.
9. `POST /api/events` — change to `admin`.
10. `GET /api/organization` — change to `admin`.
11. `GET /api/logs` — change to `admin`.
12. `GET /api/audit-logs` — change to `admin`.
13. `post-login-redirect.tsx` — add admin and super_admin entries.

### Phase 2 — Speaker course page (new page)

14. Create `/speaker/event/[eventId]/course/page.tsx`.
15. Update `/speaker/event/[eventId]/page.tsx` to link to the new course page.

---

## 9. Future considerations

### Event-scoped facilitators

This spec does **not** implement event-scoped facilitators. A facilitator can
still see and manage every event in `/staff/events` and
`/staff/events/[id]`. The next step would be:

- Create an `EVENT_FACILITATOR` join table (migration 00004).
- Filter `/staff/events` to only show events where the current facilitator is
  assigned.
- Filter event detail pages and actions (edit, publish, delete, kiosk, support)
  to only work for the assigned facilitator.
- Add assignment UI — likely under `/staff/organization` or a new section of
  event management, gated to `admin`+.

### Super admin boundary

Currently the code has `super_admin` as a level above `admin`, with only two
distinctions (inviting/promoting to admin). This spec does not add new
super_admin-only pages. Future work might add a super_admin-specific settings
page or audit view.

### Course audit for facilitators

This spec removes the course audit page (`/staff/courses`) from facilitators.
If a future requirement gives facilitators read-only access to course data
(but not creation/deletion), the guard could change from `admin` to
`facilitator` on the GET API and page — this spec sets the strictest
permission as the starting point.
