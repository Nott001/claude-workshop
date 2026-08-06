# SPEC-04 — Course Builder Decoupling (Primary Service)

Prerequisites: SPEC-03
After this: SPEC-05

## Scope

Lock down the boundary of the course module's primary authoring service — the
`useCourseCreate` hook driving `CurriculumBuilder` — and remove its two
remaining leaks: a forged/incorrect `course_id` upload field and the implicit
assumption that the server still trusts client-sent ids. This spec does not
change behaviour; it finishes the contract SPEC-03 established.

## Background

The course builder is `src/modules/courses/**`:

- `lib/use-course-create.ts` — the store/controller (all mutations).
- `lib/use-course-by-event.ts` — read side.
- `ui/curriculum-builder.tsx` and `ui/lesson-dialog.tsx` — the surface.
- `lib/lesson-utils.ts` — the only helper for content detection and upload
  endpoint selection.

Its only intentional coupling to the events module is the `eventId` scope
parameter threaded into the `POST /api/courses` payload (`event_id`), which is
the 1:1 contract from SPEC-01. Everything else it calls is owned by the course
module: `src/app/api/courses|modules|lessons|qa|upload`. Nothing in
`src/modules/courses/**` imports from `src/modules/events/**` today; SPEC-02/03
removed the events DAOs that `course-access.ts` used to pull in, and this spec
makes that guarantee mechanical.

## Changes

### 1. Fix the bogus upload `course_id` in `handleAddLesson`

`use-course-create.ts` line 192 currently appends
`formData.append("course_id", String(modules[0].id))` — `modules[0].id` is a
_module_ id. SPEC-03 made the upload routes ignore `course_id`/`module_id`
entirely and derive them from `lesson_id`, so the correct change is to stop
sending them:

- Delete the `course_id` and `module_id` `append` calls.
- Keep `file` and `lesson_id` only.

This is the client half of the SPEC-03 upload contract. The `e2e/uploads.spec.ts`
multipart bodies are updated in SPEC-06.

### 2. Prove the module boundary

Add `test/module-boundary.test.ts`: scan every file under `src/modules/courses/`
for the import pattern `from "@/modules/events` (and the `@/modules/events/…`
variants) and fail the suite if any exist. Mirrors the existing
`test/api-auth-coverage.test.ts` route-sweep approach (glob + read), so it
needs no new test tooling.

### 3. Document the one intentional seam

Add a short comment at the top of `use-course-create.ts` stating the only
events-module coupling is the `eventId` scope param feeding `event_id`, per
SPEC-01. This is documentation the next reader needs — the reasoning is
non-obvious (see AGENTS.md comment policy).

## Non-goals

- No change to `CurriculumBuilder` props or the `LessonDialog` form surface.
- No change to `lesson-utils`; `getUploadEndpoint` already picks the right
  route per content type and stays the single place that decides asset vs
  video upload.
- No new dependency.

## Files touched

- `src/modules/courses/lib/use-course-create.ts`
- `test/module-boundary.test.ts` (new)

## Verification

- `test/module-boundary.test.ts` passes.
- The upload FormData in `handleAddLesson` no longer contains
  `course_id`/`module_id`.
- `grep -rn "@/modules/events" src/modules/courses/` returns nothing.
- `pnpm typecheck`, `pnpm test` pass.
