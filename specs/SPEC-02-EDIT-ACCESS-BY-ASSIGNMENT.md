# SPEC-02 — Edit Access by Event Assignment (DAO + Policy Layer)

Prerequisites: SPEC-01
After this: SPEC-03

## Scope

1 DAO rewrite + 2 small DAO additions + 1 policy-layer rewrite + 1 new test
file. Course edit authorisation switches from "created_by matches" to "assigned
to the course's event". Nothing in this spec reads or writes `created_by`
anymore; it removes the last DAO-level references.

## Background

SPEC-01 deleted the `created_by` column. Authorisation must now answer a
different question: is this user part of the team that runs the course's
event? The team is defined by rows in `EVENT_FACILITATOR` (keyed by `user_id`)
and `EVENT_SPEAKER` (keyed by `speaker_profile_id`, which joins
`SPEAKER_PROFILE.user_id`). The service client bypasses RLS, exactly as every
existing DAO read does, so no PostgREST grants change.

Today `course-access.ts` is the exact anti-pattern this removes: a caller who
is not the creator is allowed through merely by holding `facilitator` role —
any facilitator can edit any course. The rewritten policy is strictly
assignment-based plus the admin carve-out.

## Access matrix (normative for this series)

| Caller                                             | View course / author content | Delete course  |
| -------------------------------------------------- | ---------------------------- | -------------- |
| admin / super_admin                                | allow (global)               | allow (global) |
| facilitator assigned to the course's event         | allow                        | allow          |
| speaker assigned to the course's event             | allow                        | deny           |
| anyone else (incl. unassigned facilitator/speaker) | deny (403)                   | deny (403)     |

"Assigned to the course's event" always means the _course's_ `event_id`, which
is resolved from the course/module/lesson id in the request path.

## Changes

### 1. `src/shared/db/dao/course.dao.ts`

- Rename `findCourseOwner` → `findCourseEvent` and return
  `{ id: number; event_id: number } | null` (select `id, event_id` only). Every
  caller is updated in this spec or SPEC-03.
- `findCourseByModule` and `findCourseByLesson` return
  `{ id: number; event_id: number } | null` (they delegate to
  `findCourseEvent`).
- `CourseWithEvent` drops `creator_name`; `listCoursesWithEvents` drops the
  `USER` query and `userMap` entirely, keeping only the `EVENT` side of the
  fetch.
- `createCourse` input type drops `created_by`:
  `{ course_name: string; course_description: string | null; event_id: number }`.
- Keep `userHasCourseAccess` (entitlement) untouched — it is read-side and
  already event-based.

### 2. `src/shared/db/dao/facilitator.dao.ts`

Add:

```ts
export async function checkAssignment(supabase: DbClient, userId: number, eventId: number): Promise<boolean> {
  const { data } = await supabase
    .from("EVENT_FACILITATOR")
    .select("user_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();
  return !!data;
}
```

### 3. `src/shared/db/dao/speaker.dao.ts`

Add `isAssignedByUserId` (the existing `checkSpeakerAssignment` is profile-keyed
and cannot express "does this _user_ speak at this event"). Use the same
`SPEAKER_PROFILE!inner` embed pattern already proven in
`course.dao.ts:userHasCourseAccess`:

```ts
export async function isAssignedByUserId(supabase: DbClient, userId: number, eventId: number): Promise<boolean> {
  const { data } = await supabase
    .from("EVENT_SPEAKER")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("SPEAKER_PROFILE.user_id", userId)
    .limit(1);
  return !!data && data.length > 0;
}
```

### 4. Rewrite `src/modules/courses/lib/course-access.ts`

New helpers, all returning `NextResponse | null` (null = allowed), matching the
existing guard convention:

- `canManageEvent(supabase, userId, userRole, eventId): Promise<boolean>` —
  `admin`/`super_admin` → true; `facilitator` → `facilitatorDao.checkAssignment`;
  `speaker` → `speakerDao.isAssignedByUserId`; anything else → false.
- `requireCourseAccess(courseId, userId, userRole)` — resolve
  `courseDao.findCourseEvent` (404 if missing), then `canManageEvent` (403 if
  false).
- `requireModuleAccess(moduleId, userId, userRole)` — resolve via
  `findCourseByModule` (404), then `canManageEvent`.
- `requireLessonAccess(lessonId, userId, userRole)` — resolve via
  `findCourseByLesson` (404), then `canManageEvent`.
- `requireCourseDeleteAccess(courseId, userId, userRole)` — admin → allow;
  facilitator → `findCourseEvent` (404) + `checkAssignment` (403); speaker and
  below → 403 without querying.

The three existing `require*` functions keep their signatures so SPEC-03 does
not have to touch every route. `hasMinRole` import is removed from this file
except where still needed for the delete branch's admin check.

## Files touched

- `src/shared/db/dao/course.dao.ts`
- `src/shared/db/dao/facilitator.dao.ts`
- `src/shared/db/dao/speaker.dao.ts`
- `src/modules/courses/lib/course-access.ts`
- `test/course-access.test.ts` (new)

## Verification

New `test/course-access.test.ts` asserting the matrix — mock the DAO layer (do
not hit the DB) so all nine cells run without a live schema:

- admin + unassigned → create/delete allowed.
- assigned facilitator → create allowed, delete allowed.
- assigned speaker → create allowed, delete denied.
- unassigned facilitator/speaker → both denied.
- attendee → both denied.
- unknown course/module/lesson id → 404, not 403.

Update `test/course-dao.test.ts` and `test/course-content.test.ts` for the
removed `created_by`/`creator_name` fields (the type shape changes make the old
literals fail typecheck).

`grep -rn "created_by\|creator_name\|findCourseOwner" src/` returns no hits.

`pnpm typecheck`, `pnpm test` pass.
