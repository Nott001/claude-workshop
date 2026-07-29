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
| `room/page.tsx` (both) | Update redirect URLs |
| `footer.tsx` imports | Update role type import |

## 2. Kiosk: move under event

| Old | New |
|---|---|
| `/staff/kiosk` | `/staff/events/[id]/kiosk` |
| `navbar.tsx` "Kiosk" link | point to current event (context-dependent) or remove top-level link |

New kiosk page at `src/app/staff/events/[id]/kiosk/page.tsx` pre-selects the event
so no event picker is needed. Remove old `src/app/staff/kiosk/page.tsx`.

## 3. Navbar changes

Add admin/super_admin nav items (same as facilitator). Speaker nav stays minimal.
