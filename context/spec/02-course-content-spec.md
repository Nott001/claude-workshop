# Build Phase 2 — Course Content CRUD + Progress Tracking

## Context

Events are driven by structured course content (courses → modules → lessons with typed content). Facilitators need full CRUD on all three entities. Attendees need to consume lessons and mark units as completed, with progress persisted per user per lesson. This module has no upstream dependencies beyond the auth foundation (Phase 1).

## Objective

Build the complete course content system: database migrations for COURSE, MODULES, LESSONS, and LESSON_PROGRESS; CRUD API routes; facilitator UI for content management; attendee-facing lesson viewer and progress tracking.

## Scope

- Database migrations: COURSE, MODULES, LESSONS, LESSON_PROGRESS tables (fields, types, constraints, indexes per data-model.md)
- API routes:
  - `GET /api/courses` — list courses
  - `POST /api/courses` — create course (facilitator)
  - `GET /api/courses/[id]` — course detail with modules tree
  - `PATCH /api/courses/[id]` — update course (facilitator)
  - `DELETE /api/courses/[id]` — delete course (facilitator)
  - `POST /api/courses/[id]/modules` — create module (facilitator)
  - `PATCH /api/modules/[id]` — update module (facilitator)
  - `DELETE /api/modules/[id]` — delete module (facilitator)
  - `POST /api/modules/[id]/lessons` — create lesson (facilitator)
  - `PATCH /api/lessons/[id]` — update lesson (facilitator)
  - `DELETE /api/lessons/[id]` — delete lesson (facilitator)
  - `GET /api/lessons/[id]` — lesson detail
  - `PATCH /api/lessons/[id]/progress` — update units_completed (attendee, own progress)
  - `GET /api/courses/[id]/progress` — get progress (attendee: own; facilitator: all)
- Screens:
  - `/courses` — course list (facilitator)
  - `/courses/[id]` — course detail with module/lesson tree (facilitator)
  - `/courses/[id]/modules/[moduleId]` — module/lesson editor (facilitator)
  - `/courses/[id]/lessons/[lessonId]` — lesson viewer (all roles)
  - `/courses/[id]/progress` — progress overview (attendee: own; facilitator: all)
- `modules/course-content/` domain logic (validation, ordering, progress rules)
- Business rules: `units_completed ≤ total_units` enforced; `is_completed` auto-set when units match total

## Constraints

- Only facilitators may create/edit/delete courses, modules, and lessons
- Progress updates may only be made by the owning attendee
- Lesson content rendering must support all four content types (pdf, video, image, link)

## Deliverable

- Full CRUD workflows for courses, modules, and lessons via the facilitator UI
- Lesson viewer renders PDF embeds, video players, images, and external links
- Attendees can mark units complete and see completion status persist on reload
- Facilitators can view any attendee's progress per course

## Acceptance Criteria

- [ ] Facilitator can create a course, add modules with ordering, and add lessons with content type/URL
- [ ] Lesson viewer shows correct content player for each content type
- [ ] Attendee can increment `units_completed` and see `is_completed` toggle when all units done
- [ ] Re-opening the lesson viewer shows persisted progress
- [ ] Facilitator can view progress for any attendee on the progress page
- [ ] Deleting a course cascades to modules and lessons
