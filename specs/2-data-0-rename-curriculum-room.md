# Spec Data-0 — rename courses → curriculum + room (data domain)

> **Run order:** second — renames the whole tree so the extraction specs (curriculum-0, room-1) move
> code that already carries final names.
> Full sequence: room-0 → **data-0** → curriculum-0 → room-1 → events-0 → events-1 → events-2 →
> events-3 → curriculum-1.

## Goal

"Rename everything." The word **course** is dropped from the entire surface — database tables and
columns, storage buckets and paths, TypeScript types, DAOs, API routes, and app URLs — in favour of
**curriculum** (the content) and **room** (the live session). The module/lesson API routes are also
**collapsed into one nested hierarchy** — the flat `/api/modules/[id]` and `/api/lessons/[id]` item
routes move under their curriculum parent — so the route tree and the domain tree finally match. No
behavior changes; pure renaming and route regrouping.

Confirmed decisions:

- DB tables and storage buckets are renamed (not just code/URLs).
- Room browser URL: `/events/[eventId]/room` (feed is event-scoped: `/api/room/[eventId]`).
- QA API routes stay `/api/qa/*`.
- **Module/lesson API routes collapse into one nested hierarchy** under the curriculum parent; the flat
  `/api/modules/[id]` / `/api/lessons/[id]` item routes are folded into
  `/api/curriculum/[curriculumId]/modules/[moduleId][/lessons/[lessonId]]`. Creation stays under the
  parent (`POST .../modules`, `POST .../modules/[moduleId]/lessons`); item ops (`PATCH`/`DELETE`) move
  to the nested item path. The `[curriculumId]` prefix is the access/consistency anchor; handlers still
  resolve the module/lesson by id. `by-event` stays a static-segment lookup.
- No redirects from old URLs (pre-launch, internal).
- Per-route auth posture is preserved byte-for-byte.

**Division of labour with the extraction specs:** data-0 renames _names_ (schema, storage, TS types,
DAO symbols, URL strings) while `src/modules/courses/` keeps its directory and file paths. The _module
split_ — moving authoring code into `src/modules/curriculum/` and room code into `src/modules/room/`,
deleting `courses/`, renaming file paths to `curriculum-*.ts`/`room-*.ts` — happens in curriculum-0 and
room-1. Nothing under `src/modules/courses/` is relocated here.

## Resource viewing note

Unchanged by this spec (see curriculum-0). Renames here touch names, not rendering.

## Scope

- Migration `00022` (rename; additive nothing, destructive names only).
- Storage bucket/path renames + backfill script.
- TS types, DAOs, shared helpers, embedded PostgREST selects.
- API route paths + all client callers.
- App page paths + all URL pushers.
- Tests.

## Implementation

### 1. DB migration `supabase/migrations/00022_rename_course_curriculum.sql`

Table and column renames:

```sql
ALTER TABLE "COURSE" RENAME TO "CURRICULUM";
ALTER TABLE "CURRICULUM" RENAME COLUMN course_name TO curriculum_name;
ALTER TABLE "CURRICULUM" RENAME COLUMN course_description TO curriculum_description;

ALTER TABLE "MODULE" RENAME COLUMN course_id TO curriculum_id;
ALTER TABLE "LIVE_SESSION_STATE" RENAME COLUMN course_id TO curriculum_id;
ALTER TABLE "SURVEY" RENAME COLUMN course_id TO curriculum_id;
```

Postgres carries table privileges and FK references automatically when the table is renamed, so
`GRANT SELECT ON "CURRICULUM" TO authenticated` already holds — do not re-grant, but **verify** with the
`migration-grants` test that the grant now names `"CURRICULUM"`. Rename the cosmetic identifiers:

```sql
ALTER INDEX idx_module_course_sequence RENAME TO idx_module_curriculum_sequence;
ALTER POLICY "Courses visible to authenticated" ON "CURRICULUM"
  RENAME TO "Curriculum visible to authenticated";
```

No RLS policy _body_ references COURSE (verified during exploration); if replay shows one, re-create it.

### 2. Storage

- Buckets `course_assets` / `course_videos` → `curriculum_assets` / `curriculum_videos`.
- Object paths `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}/{basename}` →
  `curriculum/{curriculumId}/modules/{moduleId}/lessons/{lessonId}/{basename}`.
- `src/shared/integrations/storage/policy.ts`: `buildCourseAssetPath`/`buildCourseVideoPath` →
  `buildCurriculumAssetPath`/`buildCurriculumVideoPath`; `COURSE_CONTENT_BUCKETS` →
  `CURRICULUM_CONTENT_BUCKETS`.
- `src/modules/courses/lib/lesson-utils.ts`: `uploadBucket` / `getUploadEndpoint` updated; upload
  endpoints below.
- **Backfill**: add `scripts/rename-storage.ts` that lists each bucket, copies objects to the new path
  prefix + new bucket, verifies, then deletes originals. Running against an empty bucket is a no-op.
  This is a one-off operator step, not a migration; document it in the script header.

### 3. TS types + DAOs

`src/shared/types.ts`:

- `Course` → `Curriculum`; `CourseWithContent` → `CurriculumWithContent`; `Event.course_id` →
  `curriculum_id`; `Event.COURSE` embed → `CURRICULUM`; `Module.course_id` → `curriculum_id`;
  `LiveSessionState.course_id` → `curriculum_id`; `LandingEvent.course_name` → `curriculum_name`.
- `CourseSpeaker` → `CurriculumSpeaker` (the builder roster shape).

DAO layer:

- `src/shared/db/dao/course.dao.ts` → `curriculum.dao.ts`; every symbol that reads/writes curriculum:
  `findCourseWithDetails` → `findCurriculumWithDetails`, `findCourseByEvent` →
  `findCurriculumByEvent`, `findCourseByModule` → `findCurriculumByModule`,
  `findCourseScheduleByEvent` → `findCurriculumScheduleByEvent`, `userHasCourseAccess` →
  `userHasCurriculumAccess`, `createCourse`/`deleteCourse` → `createCurriculum`/`deleteCurriculum`.
- Embedded selects `COURSE!event_id(...)` / `COURSE(...)` → `CURRICULUM!event_id(...)` /
  `CURRICULUM(...)` in every DAO.
- `src/modules/courses/lib/course-access.ts`: `requireCourseAccess` → `requireCurriculumAccess`,
  `requireCourseDeleteAccess` → `requireCurriculumDeleteAccess`, `CourseAccessContext` →
  `CurriculumAccessContext` (the `canManageEvent` copy keeps its name). The file itself moves to shared
  in curriculum-0.
- `src/modules/courses/lib/course-module-service.ts`: the `CurriculumModuleService` /
  `CurriculumModuleServiceError` symbols (file path renamed in curriculum-0).
- `src/modules/courses/lib/course-errors.ts`: `CurriculumServiceError` (file path renamed in room-1).
- Builder/types: `ModuleWithLessons`, `ModuleSpeakerProfile` keep their names (no "course" in them).

### 4. API routes

Move/rename paths — update every client caller and route handler. The module/lesson routes are
**renamed and folded into one nested hierarchy** (the current flat `/api/modules/[id]` and
`/api/lessons/[id]` item routes disappear):

```
/api/courses                       → /api/curriculum
/api/courses/[courseId]            → /api/curriculum/[curriculumId]
/api/courses/[courseId]/modules    → /api/curriculum/[curriculumId]/modules          (POST: create module)
/api/courses/event/[eventId]       → /api/curriculum/by-event/[eventId]
/api/modules/[id]                  → /api/curriculum/[curriculumId]/modules/[moduleId]
                                    (PATCH lock/times/speaker, DELETE; the is_locked branch stays)
/api/modules/[id]/lessons          → /api/curriculum/[curriculumId]/modules/[moduleId]/lessons
                                    (POST: create lesson)
/api/lessons/[id]                  → /api/curriculum/[curriculumId]/modules/[moduleId]/lessons/[lessonId]
                                    (GET/PATCH/DELETE)
/api/upload/course-asset           → /api/upload/curriculum-asset
/api/upload/course-video           → /api/upload/curriculum-video
/api/courses/[courseId]/room       → /api/room/[eventId]
/api/courses/[courseId]/live/highlight → /api/room/[eventId]/highlight
/api/qa/*                          → unchanged
/api/events/*  /api/events/[id]/schedule → unchanged
```

The room feed becomes **event-scoped** (`/api/room/[eventId]`): it resolves the curriculum via
`EVENT.id = CURRICULUM.event_id` internally, so the `/events/[eventId]/room` page needs no extra hop.
`/api/room/[eventId]/highlight` keeps the current auth posture (GET public, POST/DELETE
`canManageEvent`). Middleware needs no new public entries (all these routes are auth-gated); verify the
highlight GET still passes.

### 5. App URLs

```
/staff/courses                 → /staff/curriculum
/speaker/event/[eventId]/course → /speaker/event/[eventId]/curriculum
/courses/[courseId]/room       → /events/[eventId]/room   (page param becomes eventId)
```

Update room URL pushers: `event-register-card.tsx`, `speaker-event-detail.tsx`, `staff-event-detail.tsx`
→ `/events/${eventId}/room`. Nav items: no "Courses" label exists, so `nav-items.ts` is untouched.

The `QaModuleCard` created by room-0 moves with the room page: `src/app/courses/[courseId]/room/qa-module-card.tsx`
→ `src/app/events/[eventId]/room/qa-module-card.tsx`, so no `course` token survives in the app tree and
the page's co-located import stays intact. It relocates into the room module (`room/qa/components`) in
room-1.

### 6. Tests

Update every test referencing the old names (paths, URL strings, type names, DAO symbols): `course-dao*`,
`api-course-*`, `api-module-*`, `api-lessons-*`, `api-upload-course`, `api-live-highlight-route`,
`api-course-room-route`, `course-*` component/lib tests, `staff-course-section`, `staff-event-detail-tabs`,
`course-room-page`, `use-room-access`, `current-topic*`, `live-session*`, `room-lesson-row`,
`module-schedule-badge`, `content-type-meta`, `lesson-utils`, `module-boundary`, `migration-replay`,
`migration-grants`, `rls-policy-correlation`. The `api-module-*` / `api-lessons-*` suites now exercise
the **nested** paths (`/api/curriculum/[curriculumId]/modules/[moduleId]`,
`.../[moduleId]/lessons`, `.../[lessonId]`).

## Definition of done

- No occurrence of the word `course` remains in schema, storage, types, DAOs, API, app URLs, or tests
  (verified by grep); `src/modules/courses/` holds no `course`-named symbol or file name.
- No flat `/api/modules/[id]` or `/api/lessons/[id]` routes remain; module/lesson routes are nested
  under `/api/curriculum/[curriculumId]` only (grep-verified).
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.
- Storage backfill script exists and runs to no-op against empty buckets.

## Out of scope

Module extraction (curriculum-0, room-1), the event schedule (events-*), builder schedule bounds
(curriculum-1). This spec intentionally renames **before** those move code.
