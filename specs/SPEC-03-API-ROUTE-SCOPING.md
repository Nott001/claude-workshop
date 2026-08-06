# SPEC-03 — API Route Scoping

Prerequisites: SPEC-02
After this: SPEC-04

## Scope

Rework the course mutation and upload API routes to enforce the SPEC-02 policy.
Two upload routes get an authoritative storage path derived server-side from
`lesson_id`, and the upload routes' privilege floor drops from `facilitator` to
assignment-based. Client callers are updated in SPEC-04.

## Background

SPEC-02 moved the policy into `course-access.ts`. The routes still have the old
behaviours this series exists to remove:

- `POST /api/courses` uses a `speaker`-only assignment check and passes
  `created_by` to `createCourse`.
- `PATCH`/`DELETE /api/courses/[id]` compare `course.created_by` with the
  caller — the exact "any facilitator edits anything" hole, and the DELETE is
  effectively admin-only.
- `PATCH /api/qa/module/[moduleId]` (lock toggle) checks role only; an
  unassigned speaker can lock any module.
- `POST /api/qa/module/[moduleId]` (send question) resolves `event_id` through
  `findCourseOwner`.
- Upload routes trust `course_id`/`module_id` from the client form. Aside from
  being forgeable, the builder currently sends a module id in the `course_id`
  field (see SPEC-04), so `buildCourseAssetPath`/`buildCourseVideoPath` receive
  a course id that is actually a module id. Deriving the path from `lesson_id`
  fixes the stored-key correctness too.

## Changes

### 1. `src/app/api/courses/route.ts` (POST)

- Floor stays `requireRole("speaker")` (a course is only ever created by the
  event's own team, never by an attendee).
- Replace the inline `hasMinRole`/`checkSpeakerAssignment` block with
  `canManageEvent(supabase, guard.user.id, guard.user.role, parsed.data.event_id)`
  → 403 `"You are not assigned to this event"` when false.
- Drop `created_by` from the `createCourse` call. `speakerDao` import and the
  `hasMinRole` import are no longer needed here.
- `GET` (admin-only list) is unchanged apart from the `creator_name` removal
  that SPEC-02 already made in the DAO.

### 2. `src/app/api/courses/[id]/route.ts`

- `PATCH`: replace the `findCourseOwner` + `created_by` check with
  `requireCourseAccess(Number(id), guard.user.id, guard.user.role)`.
- `DELETE`: replace the `findCourseById` + `created_by` check with
  `requireCourseDeleteAccess(Number(id), guard.user.id, guard.user.role)`. Keep
  the subsequent `findCourseById` fetch solely for the storage-cleanup folder
  walk and the audit-log course name (it no longer authorises anything).
- `GET` unchanged (any authenticated speaker can read; entitlement for
  attendees is enforced in the storage route, not here).

### 3. `src/app/api/qa/module/[moduleId]/route.ts`

- `POST` (send question): swap `courseDao.findCourseOwner` for
  `courseDao.findCourseByModule` (which after SPEC-02 returns `{ id, event_id }`).
  Nothing else about the send path changes.
- `PATCH` (lock): after `requireRole("speaker")`, gate on
  `requireModuleAccess(Number(moduleId), guard.user.id, guard.user.role)` so an
  unassigned speaker/facilitator cannot flip a lock. Note this also 404s
  cleanly on an unknown module.

### 4. `src/app/api/upload/course-asset/route.ts` and `course-video/route.ts`

Both routes change the same way:

- Guard: replace `requireRole("facilitator")` with `requireRole("speaker")`
  followed by `requireLessonAccess(Number(lessonId), guard.user.id, guard.user.role)`
  — an assigned speaker may now upload; an unassigned facilitator may not.
- Drop the `course_id`/`module_id` form fields. Only `file` and `lesson_id`
  are read. Missing `lesson_id` still 400s _before_ any storage write.
- Resolve the path server-side:
  `findLessonModule(lessonId)` → `findModuleCourse(moduleId)` → then
  `buildCourseAssetPath(courseId, moduleId, lessonId, filename)` (same for
  video). A missing lesson/module chain → 400 with no storage write.
- `updateLesson(lessonId, { content_url })` is unchanged.

The storage path shape (`courses/{course}/modules/{module}/lessons/{lesson}/…`)
is unchanged, so the delete-cleanup walk in `courses/[id]/route.ts` and the
`api-event-delete.test.ts` bucket expectations still line up. Grant/permission
notes: uploads run under the service client and R2 bindings, so no PostgREST
grant changes are needed.

## Files touched

- `src/app/api/courses/route.ts`
- `src/app/api/courses/[id]/route.ts`
- `src/app/api/qa/module/[moduleId]/route.ts`
- `src/app/api/upload/course-asset/route.ts`
- `src/app/api/upload/course-video/route.ts`
- `test/api-upload-course.test.ts` (new) — see Verification

## Verification

New `test/api-upload-course.test.ts` (route-level, mocking `requireRole`,
`requireLessonAccess`, the DAO chain, and `uploadToStorage`):

- assigned speaker upload → 200, path built from the DAO-derived course/module
  ids (not from the body — body no longer carries them).
- unassigned facilitator/speaker → 403, no storage call.
- attendee → 403.
- unknown `lesson_id` → 400, no storage call.
- missing `lesson_id` → 400, no storage call.
- file-type/size rejects still 400 before the path build.

Existing suites to update:

- `test/api-course-by-event.test.ts` mocks `userHasCourseAccess`; unchanged by
  this spec unless it asserted `created_by` in a response.
- `test/api-event-delete.test.ts` — verify its course-bucket assertions still
  pass (paths unchanged by design).

Manual sweep: `grep -rn "created_by\|findCourseOwner\|formData.get(\"course_id\")" src/app/api/`
returns no hits.
