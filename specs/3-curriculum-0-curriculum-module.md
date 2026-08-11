# Spec Curriculum-0 — extract the curriculum module (curriculum domain)

> **Run order:** third — data-0 already renamed every symbol/URL; this spec splits the code and applies
> final file paths. Must precede room-1, which moves the room-side code out of the remaining courses
> module.
> Full sequence: room-0 → data-0 → **curriculum-0** → room-1 → events-0 → events-1 → events-2 → events-3 →
> curriculum-1.

## Goal

Split `src/modules/courses/` into an authoring half and a live half. This spec moves the **authoring**
surface (curriculum/module/lesson creation, editing, scheduling, reorder, uploads) into a new
`src/modules/curriculum/` with final file names, relocates the cross-module shared bits, and updates every
importer. The room-side code stays in `courses` until room-1 deletes it. **API URLs are already final**
(data-0); routes only repoint their imports at `@/modules/curriculum/*`.

## Resource viewing policy (repo-wide)

We are dropping the inline resource viewer and the YouTube player. Every lesson resource — pdf, image,
video, link — opens directly in a new browser tab; there is no in-app playback or preview.

- **Delete** `src/modules/courses/components/youtube-player.tsx` (`YouTubePlayer` +
  `getYouTubeVideoId`) and `test/youtube-player.test.ts`. Do **not** move them into curriculum.
- Builder "View" (`lesson-row.tsx`) and room lesson rows must be plain external links with
  `target="_blank" rel="noopener noreferrer"` (all content types use `content_url`).
- No new viewer/preview/player component may be introduced in curriculum or room.

## Scope

- New module `src/modules/curriculum/`.
- Move the authoring components and lib with final file names (list below).
- Move cross-module bits to shared.
- Update every importer (app pages, API routes, tests).
- Update `test/module-boundary.test.ts`.
- Delete `youtube-player.tsx` + its test (resource policy).

## Implementation

### 1. New module `src/modules/curriculum/`

- `components/`: `curriculum-builder-section.tsx` (was `course-builder-section.tsx`;
  `CourseBuilder` type → `CurriculumBuilderApi`, `CourseBuilderSection` →
  `CurriculumBuilderSection`), `curriculum-builder.tsx`, `lesson-dialog.tsx`, `lesson-row.tsx`,
  `module-card.tsx`, `module-header.tsx`, `module-schedule-editor.tsx`, `move-button.tsx`,
  `session-time-picker.tsx`.
- `lib/`: `schemas.ts`, `curriculum-module-service.ts` (was `course-module-service.ts`),
  `reorder.ts`, `scheduling.ts`, `lesson-utils.ts`, `use-curriculum-create.ts` (was
  `use-course-create.ts`; `useCourseCreate` → `useCurriculumCreate`), `use-curriculum-by-event.ts`
  (was `use-course-by-event.ts`; `useCourseByEvent` → `useCurriculumByEvent`).

### 2. To shared

- `src/shared/types.ts`: add `ModuleWithLessons`, `ModuleSpeakerProfile`, `CurriculumSpeaker`
  (from `courses/lib/types.ts`; `CourseSpeaker` already renamed in data-0).
- `src/shared/lib/curriculum-access.ts`: move `courses/lib/course-access.ts`
  (`requireCurriculumAccess` / `requireModuleAccess` / `requireLessonAccess` /
  `requireCurriculumDeleteAccess` / `canManageEvent` + `CurriculumAccessContext`). The events module's
  own `canManageEvent` copy stays untouched.
- `src/shared/lib/schedule-options.ts`: move `buildTimeOptions` / `isOffGrid` from
  `courses/lib/schedule-options.ts` so the events form (events-1) reuses them **without importing
  curriculum**.

Do **not** move in this spec (room-owned, room-1 handles them): `content-type-meta.ts`, `current-topic.ts`,
`live-session-service.ts`, `room-access-policy.ts`, `fetch-course-room-access.ts`,
`use-course-room-access.ts`, `course-errors.ts`, `live-session.dao.ts`, `room-lesson-row.tsx`,
`current-topic-card.tsx`, `module-schedule-badge.tsx`.

### 3. API routes (URLs already final — data-0)

Point imports at `@/modules/curriculum/*`:

- `src/app/api/curriculum/route.ts`, `src/app/api/curriculum/[curriculumId]/route.ts`,
  `src/app/api/curriculum/[curriculumId]/modules/route.ts`,
  `src/app/api/curriculum/by-event/[eventId]/route.ts`
- `src/app/api/curriculum/modules/[id]/route.ts`, `src/app/api/curriculum/modules/[id]/lessons/route.ts`
- `src/app/api/curriculum/lessons/[id]/route.ts`
- `src/app/api/upload/curriculum-asset/route.ts`, `src/app/api/upload/curriculum-video/route.ts`

Room/live routes (`/api/room/[eventId]`, `/api/room/[eventId]/highlight`, `/api/qa/*`) still import the
courses module here — room-1 updates them.

### 4. App pages

- `src/app/speaker/event/[eventId]/curriculum/page.tsx` → curriculum imports.
- `src/modules/events/pages/staff-event-detail.tsx` → curriculum imports (`useCurriculumByEvent`,
  `useCurriculumCreate`, `CurriculumBuilderSection`, `CurriculumSpeaker`).
- `src/app/events/[eventId]/room/page.tsx` keeps its current (room-side) imports until room-1.

### 5. Module boundary

`test/module-boundary.test.ts`: `courses` may not import `events` becomes **`curriculum` may not import
`events` or `room`** — curriculum is a leaf. The temporary rule "courses may not import curriculum" is
added and removed by room-1.

### 6. Delete

`src/modules/courses/components/youtube-player.tsx` and `test/youtube-player.test.ts` (resource policy).

## Tests

- Repoint the authoring tests that import `@/modules/courses/*`: `api-course-crud`, `api-courses-post`,
  `api-course-by-event`, `api-module-lesson-crud`, `api-module-schedule-patch`, `api-lessons-patch`,
  `api-upload-course`, `course-content`, `course-reorder`, `course-scheduling`, `course-module-service`,
  `curriculum-builder`, `lesson-utils`, `schedule-options`, `use-course-create-schedule`,
  `staff-course-section`, `staff-event-detail-tabs`, `course-dao`, `course-dao-writes`, `module-boundary`.
- Delete `youtube-player.test.ts`.
- Room tests (`course-room-page`, `use-room-access`, `room-lesson-row`, `current-topic*`,
  `live-session*`, `api-live-highlight-route`, `api-course-room-route`) are untouched until room-1.

## Definition of done

- `src/modules/curriculum/` holds all authoring code; the courses module holds only room-side leftovers.
- Shared types / curriculum-access / schedule-options relocated; all imports green.
- `youtube-player` gone; every lesson link opens a new tab.
- `pnpm lint`, `pnpm typecheck`, `pnpm format` clean; `pnpm test` green; coverage not lowered.

## Out of scope

room-1 extraction, room-0 (already done), events session schedule (events-0…3), builder schedule bounds
(curriculum-1).
