# 14. Remove the courses list page and its dead code

## Goal

The standalone courses audit page (`/staff/courses`) is orphaned: the staff
navbar no longer links to it, and courses are 1:1 with events — a course is
created, managed and entered from its event's Course tab, with the event as
the parent. The page and its supporting code exist only to "view all courses",
which staff no longer do, so the page, the list half of `/api/courses` and the
DAO read behind them are removed.

## Run order

Fourteenth. Nothing in the series touches these files otherwise; it sits here,
just before the changelog sheet, so the removal is one self-contained unit.

## Files touched

- Delete `src/app/staff/courses/page.tsx`
- `src/app/api/courses/route.ts` — drop the `GET` handler (keep `POST`)
- `src/shared/db/dao/course.dao.ts` — drop `CourseWithEvent` and
  `listCoursesWithEvents`; prune the now-unused `pageBounds`/`PaginatedResult`
  imports
- `test/course-dao-writes.test.ts` — drop the `listCoursesWithEvents` block
  and the two dead-database/event-lookup tail tests
- `test/e2e/courses.spec.ts` — drop the `GET /api/courses` → 403 assertion

## Prerequisites

- Sheets 01–13 complete and verified.

## Steps

1. Delete `src/app/staff/courses/page.tsx` — its only data source was
   `GET /api/courses`, removed below.
2. In `src/app/api/courses/route.ts`, remove the `GET` handler and the
   `listCoursesWithEvents` reference. Keep the `POST` handler: course creation
   from an event's Course tab flows through it (`use-course-create.ts`).
   Verify no import becomes unused (`courseDao` is still needed for
   `createCourse`).
3. In `src/shared/db/dao/course.dao.ts`, remove the `CourseWithEvent` type and
   `listCoursesWithEvents`. Nothing else reads them — `rg
"listCoursesWithEvents|CourseWithEvent"` should find no source references
   after this step. Drop `pageBounds` and `PaginatedResult` from the imports
   if nothing else in the file uses them.
4. In `test/course-dao-writes.test.ts`, delete the
   `describe("course.dao listCoursesWithEvents", …)` block and the two tests
   that exercise `listCoursesWithEvents` off a dead database / a failed event
   lookup. Keep every write-path test (`createCourse`, `updateCourse`, …).
5. In `test/e2e/courses.spec.ts`, remove the two lines that `GET /api/courses`
   and assert 403 — the endpoint no longer exists, so the route answers 405
   and the "cannot list courses" claim is moot. Keep the attendee's
   module-authoring 403 assertions, which test a route that still exists.
6. Gates: `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Verification

- `rg "listCoursesWithEvents|CourseWithEvent" src/` finds nothing.
- `rg "staff/courses|/api/courses\?" src/` finds nothing (the room, event,
  detail and modules routes use `/api/courses/<id>…`, which remain).
- `GET /api/courses` is gone: `src/app/api/courses/route.ts` exports only
  `POST`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test` all pass; coverage
  is at or above the `vitest.config.ts` thresholds.

## Risks

- The e2e suite is Playwright, not vitest — it is not run by `pnpm test`.
  Grep the edited spec to confirm the attendee-authoring assertions survived;
  a live run is out of scope for this series and unchanged in behaviour.
- Deleting the wrong read would strand the event Course tab. The tab reads
  `/api/courses/event/[id]` and `[courseId]` routes — untouched here.

## Notes

- The CHANGELOG already records the navbar removal of "Courses" (the entry
  from the earlier staff-nav consolidation). Sheet 15's changelog entry
  records the page's removal itself.
