# SPEC-02: Route Restructuring

## 1. Speaker routes: `/speakers/` → `/speaker/`

Move entire `src/app/speakers/` directory to `src/app/speaker/`.

### Route mapping

| Old (plural) | New (singular) |
|---|---|
| `/speakers/dashboard` | `/speaker/dashboard` |
| `/speakers/dashboard/[eventId]` | `/speaker/event/[eventId]` |
| `/speakers/dashboard/[eventId]` room link | `/speaker/event/[eventId]/room` |
| `/speakers/update-info/[[...rest]]` | **Removed** — merged into `/user/` |

### Removed pages (admin speaker profile management)
- `/speakers` (profile list)
- `/speakers/[id]/edit` (profile edit)

### Internal reference updates

| File | Change |
|---|---|
| `post-login-redirect.tsx` | `speaker: "/speaker/dashboard"` |
| `navbar.tsx` | `href: "/speaker/dashboard"` |
| `user.dao.ts` `listStaff()` | Add `admin`, `super_admin` to `.in("role", [...])` |
| `use-speaker-edit.ts` | Remove (page removed) |
| `use-speaker-update-info.ts` | Remove (page removed) |
| `events/[id]/room/page.tsx` exit redirect | Attendee: `/events/[eventId]`. Speaker: `/speaker/event/[eventId]`. Staff: redirects to `/staff/events/[eventId]/room` |
| `staff/events/[id]/room/page.tsx` exit redirect | Staff: `/staff/events/[eventId]`. Speaker: `/speaker/event/[eventId]` |
| `footer.tsx` imports | Update role type import |

## 2. Kiosk: move under event

| Old | New |
|---|---|
| `/staff/kiosk` | `/staff/events/[id]/kiosk` |
| `navbar.tsx` "Kiosk" link | point to current event (context-dependent) or remove top-level link |

New kiosk page at `src/app/staff/events/[id]/kiosk/page.tsx` pre-selects the event
so no event picker is needed. Remove old `src/app/staff/kiosk/page.tsx`.

## 3. Course pages

- `/staff/courses/new` — **Removed** (course creation embedded in event dashboard, see SPEC-03)
- `/staff/courses/[id]` — **Removed** (course detail moved into event dashboard)
- `/staff/courses` — **Replaced**: read-only audit table gated to admin+ (see note below)

The admin course audit page at `/staff/courses` is a read-only table listing all courses with:
- Course name
- Linked event (title + date)
- Created by speaker (full name)
- Created at / Updated at timestamps
- No create/edit/delete actions — this is an audit view only

Gated to `hasMinRole(role, "admin")`. Not visible to facilitators or speakers in navbar.

## 4. Navbar changes

Add admin/super_admin nav items (same as facilitator plus course audit page). Speaker nav stays minimal.
Remove `/staff/courses/new` from facilitator nav items.
