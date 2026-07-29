# SPEC-06: Courses

## Model change

Courses are now 1:1 with events and owned by a speaker.

### Before (shared)

```
COURSE ←──────── EVENT        COURSE has no owner
 1  ─────────→ N              course_id lives on EVENT
```

### After (owned)

```
COURSE ─────────→ EVENT       EVENT drops course_id
↓                              COURSE gets event_id (UNIQUE, NOT NULL)
USER (created_by)              COURSE gets created_by (speaker)
```

## Database

See SPEC-04 migration 00004 for the schema changes.

## API routes

### `POST /api/courses` — Create course for an event

| Aspect | Detail |
|---|---|
| Gate | `requireRole("speaker")` (speaker+ via hierarchy) |
| Body | `{ event_id, course_name, course_description? }` |
| Validation | Requires caller to be assigned as a speaker to `event_id` |
| Side effect | `created_by` set to `guard.user.id` |

### `GET /api/courses/event/[eventId]` — Load course by event (NEW)

Replaces the old pattern of loading event → reading `course_id` → loading course.

| Aspect | Detail |
|---|---|
| Gate | `requireRole("speaker")` |
| Response | Full course tree: course + modules + lessons |
| Behavior | Returns `{ course: null }` if no course exists for the event |

### `GET /api/courses/[id]` — Get course by ID

| Aspect | Detail |
|---|---|
| Gate | `requireRole("speaker")` |
| Usage | Internal (module/lesson management) |

### `PATCH /api/courses/[id]` — Update course

| Aspect | Detail |
|---|---|
| Gate | `requireRole("speaker")` |
| Validation | Only the `created_by` user can update |

### `DELETE /api/courses/[id]` — Delete course

| Aspect | Detail |
|---|---|
| Gate | `facilitator` (admin decisions) |
| Validation | Only the `created_by` user or admin+ can delete |

### Module/lesson routes

Unchanged gate (`speaker`), but now require module/lesson's course
to belong to an event the caller is assigned to.

## Removed routes (standalone course management)

- `GET /api/courses` (listing) — no longer needed, courses are scoped to events
- `/staff/courses` page — removed
- `/staff/courses/new` page — removed
- `/staff/courses/[id]` page — removed

## Room access changes

Instead of:

```
event.course_id → findCourseById(id) → modules/lessons
```

Now:

```
event.id → findCourseByEventId(eventId) → modules/lessons
```

`useRoomAccess` hook updated to call `GET /api/courses/event/[eventId]`.
If `course` is `null`, show "No course yet — waiting for speaker."

## Course creation UX

- **Speaker dashboard** (`/speaker/event/[eventId]`): "Build Course" button/section
- **Staff dashboard** (`/staff/events/[id]`): Course section shows "View Course" (f+)
  or "Waiting for speaker to create course" (no course yet)
- Admin-created events without a speaker assigned show "Assign a speaker first"

## Navbar

Remove `/staff/courses` and `/staff/courses/new` from facilitator nav items.
