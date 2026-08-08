# SPEC-05 — Unified course room (course-keyed live state)

## Scope

Rooms are course presentations, not event pages. Re-key the room and its live
session state to COURSE, unify the three role-scoped room pages into one
`/courses/[courseId]/room`, and move the live-state data access under the courses
module. Supersedes the earlier plan that only unified the room pages while keeping
event URLs.

## Background

The "event room" has always been the event's course: the page renders
`course.MODULE`/`LESSON`, a roadmap sidebar, per-module QA, and a highlight pointer
into course content. Three artifacts tie the room to the event rather than the
course:

- `LIVE_SESSION_STATE` is keyed by `event_id` (`00001`), while its
  `highlighted_lesson_id` points at a LESSON — course content. The highlight is
  course-presentation state, keyed by the operational wrapper.
- `EVENT`/`COURSE` are welded 1:1 (`COURSE.event_id NOT NULL UNIQUE` from `00004`),
  so an event-keyed row is redundant with the course link.
- The three room pages (`/events/[id]/room`, `/speaker/event/[eventId]/room`,
  `/staff/events/[id]/room`) are ~85% duplicates; the app-shell chrome-hiding regex
  in `src/shared/components/app-shell.tsx` only covers the attendee room.

The room's identity is the course; the event remains the operational wrapper
(tickets, schedule, chat, check-in) that gates entry.

## Changes

### Schema — `00014_live_session_state_course.sql`

- `ADD COLUMN course_id`; backfill
  `UPDATE "LIVE_SESSION_STATE" s SET course_id = c.id FROM "COURSE" c WHERE c.event_id = s.event_id`
  (`COURSE.event_id` is NOT NULL, so every row resolves); `SET NOT NULL`;
  `DROP CONSTRAINT "LIVE_SESSION_STATE_pkey"`; `ADD PRIMARY KEY (course_id)`;
  FK `course_id → "COURSE"(id) ON DELETE CASCADE`; `DROP COLUMN event_id`.
- Grants (SELECT to anon/authenticated), the `Live state visible to all` RLS
  policy, and the realtime publication entry are table-level and unchanged.
  (AGENTS.md grant warning: the public highlight GET reads as anon, so its SELECT
  grant must survive the re-key or the room ships empty.)
- Numbered `00014` so it cannot collide with SPEC-14's renumber plan (00011–00013).
- Update `supabase/database_schema.mmd` (`LIVE_SESSION_STATE` becomes COURSE-keyed).

### Courses-module data access — `src/modules/courses/db/live-session.dao.ts`

- `findStateWithLesson(supabase, courseId)` — `select("*, LESSON(id, description, content_type)").eq("course_id", courseId).single()`, returns the row or null.
- `setHighlight(supabase, courseId, lessonId, updatedBy)` — `upsert({ course_id, highlighted_lesson_id, updated_by, updated_at }, { onConflict: "course_id" }).select().single()`, returns `{ data, error }`.
- Mirrors `src/modules/events/db/event.dao.ts` (SPEC-01) as the module-owns-its-DAO pattern.

### Courses-module domain — `src/modules/courses/lib/live-session-service.ts`

- `getCourseHighlight`, `setCourseHighlight`, `clearCourseHighlight` — port of the
  SPEC-02 event-service highlight functions, re-keyed to course: lesson missing →
  404, lesson not in the course (`course.dao.findLessonById`/`findModuleById`) →
  400, upsert failure → 500. Typed status errors; no HTTP types in signatures.
- `src/modules/events/lib/event-service.ts` drops `getEventHighlight` /
  `setEventHighlight` / `clearEventHighlight` — this removes the last inline
  `supabase.from` chains from the events module.
- Add `course.dao.findCourseIdByEventId(supabase, eventId)` (light
  `select("id").eq("event_id", …).maybeSingle()`); `deleteEvent` uses it for the
  storage-cleanup walk; `setEventHighlight`'s course lookup dies with the function.

### Room — one unified page at `/courses/[courseId]/room`

- New `src/app/courses/[courseId]/room/page.tsx` (`CourseRoomPage`) renders for all
  roles, keeping the per-role behavior the earlier plan expressed as variant flags:
  exit destination (`/events/[id]` / `/staff/events/[id]` / `/speaker/event/[eventId]`),
  highlight controls (staff/speaker only), reload-after-lock, and the register CTA
  on `no_ticket`.
- Delete `/events/[id]/room`, `/speaker/event/[eventId]/room`, `/staff/events/[id]/room`.
- Room hook: `use-room-access.ts` → `src/modules/courses/lib/use-course-room-access.ts`
  (`useCourseRoomAccess(courseId)`); `room-access-policy.ts` → course-room access
  policy (`canAccessCourseRoom`); `fetch-event-access.ts` → course-room access
  fetcher that resolves the linked event via `COURSE.event_id` and gates
  tickets/assignment against `event.id`.
- Room feed route `GET /api/courses/[courseId]/room` returns `{ course, event }`
  (course via `course.dao.findCourseById`, event via `event.dao.findById`) with
  entitlement `hasMinRole(facilitator)` or `course.dao.userHasCourseAccess`. Keep
  `/api/courses/event/[eventId]` for the speaker course builder.
- Highlight route `GET|POST|DELETE /api/courses/[courseId]/live/highlight` — GET
  public (404 without a course); POST/DELETE `requireAuth` + assigned-to-course
  (admin+, assigned facilitator/speaker, per SPEC-03). Delete
  `/api/events/[id]/live/highlight`.
- Rename surface: components, copy ("Course Room", "EXIT COURSE ROOM", "Enter
  Course Room", "Loading course room…"), `LiveSessionState.event_id` → `course_id`
  in `src/shared/types.ts`, app-shell hide regex →
  `/^\/courses\/[^/]+\/room/`.
- Entry points: "Enter Room" buttons on `/events/[id]`, the staff dashboard, and
  the speaker dashboard → `/courses/${course.id}/room`.
- Highlight stays SWR-polled every 5s — no realtime (the table's unused publication
  entry is dropped in SPEC-14).

## Non-goals

- No change to the `EVENT`/`COURSE` 1:1 link (`COURSE.event_id NOT NULL UNIQUE`) —
  making courses reusable across events is a separate model decision.
- No change to the kiosk, the QA module lock, or the `/api/courses/event/[eventId]`
  course-builder feed.
- No middleware changes.

## Files touched

- `supabase/migrations/00014_live_session_state_course.sql` (new);
  `supabase/database_schema.mmd`
- `src/modules/courses/db/live-session.dao.ts` (new),
  `src/modules/courses/lib/live-session-service.ts` (new)
- `src/shared/db/dao/course.dao.ts` (+ `findCourseIdByEventId`),
  `src/modules/events/lib/event-service.ts` (− 3 highlight fns), `src/shared/types.ts`
- `src/app/courses/[courseId]/room/page.tsx` (new); 3 room pages deleted
- `src/app/api/courses/[courseId]/room/route.ts` (new),
  `src/app/api/courses/[courseId]/live/highlight/route.ts` (new),
  `src/app/api/events/[id]/live/highlight/route.ts` (deleted)
- `src/modules/events/lib/{use-room-access,room-access-policy,fetch-event-access}.ts`
  → `src/modules/courses/lib/` (renamed + re-keyed)
- `src/shared/components/app-shell.tsx`, 3 entry-point pages
- Tests: re-key `api-live-highlight-route.test.ts`, `use-room-access.test.tsx`,
  `room-access.test.ts`, `live-highlight.test.ts`, `app-shell-footer.test.tsx`; new
  `live-session-dao.test.ts`, `live-session-service.test.ts`, course-room page/feed
  tests; strip the highlight block from `event-service.test.ts`; boundary tests
  unchanged (courses must not import events; events → courses is allowed).

## Verification

- `pnpm test` — re-keyed suites + new courses suites green; boundary tests still pass.
- `pnpm typecheck`, `pnpm lint` green; `rg "live/highlight" src/app/api/events` empty.
- Migration applied against the DB: rows backfilled to `course_id`; existing
  highlight states preserved; anon SELECT grant intact.
- Manual: all three roles reach `/courses/[courseId]/room` navbar-free; highlight
  toggles only for assigned staff/speakers; a ticketless attendee sees the register CTA.
