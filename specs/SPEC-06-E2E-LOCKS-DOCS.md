# SPEC-06 — E2E Alignment, Regression Locks, Docs

Prerequisites: SPEC-05
After this: (none — final spec in the sequence)

## Scope

Bring the Playwright suites in line with the new policy and upload contract,
promote the long-fixme course-creation test to a real test, and sweep the last
SPEC-09 drift references. No product-code changes; this is the hardening pass.

## Background

Four things now disagree with the codebase and must be reconciled:

1. `test/e2e/courses.spec.ts` authorises module/lesson work with facilitators
   who are never assigned to the event. Under SPEC-02 those callers 403.
2. The same file's `test.fixme` "facilitator can create a course through the
   API" is fixme because `createCourse` once omitted `event_id`. SPEC-02 fixed
   the DAO input; the test's payload also never sent `event_id`, which SPEC-03
   now requires. With both fixed, the test should pass and the marker drops.
3. `test/e2e/uploads.spec.ts` sends `course_id`/`module_id` in its multipart
   bodies. SPEC-03 made those fields dead and SPEC-04 stopped the builder
   sending them; the spec still sends them (harmlessly ignored, but it would
   mask a regression if the route started trusting them again).
4. `test/e2e/fixtures.ts` and `courses.spec.ts` reference
   SPEC-09-TEST-STRATEGY §9 for the schema drift; the drift this series cares
   about is now resolved by SPEC-01, and the upload spec's "a missing field is
   refused" test still treats `course_id`/`module_id` as required.

## Changes

### 1. `test/e2e/fixtures.ts` — add `assignFacilitator`

```ts
export async function assignFacilitator(db: SupabaseClient, userId: number, eventId: number): Promise<void> {
  const { error } = await db.from("EVENT_FACILITATOR").insert({ event_id: eventId, user_id: userId, assigned_by: userId });
  if (error) throw new Error(`EVENT_FACILITATOR insert failed: ${error.message}`);
}
```

`cleanup` already deletes `EVENT_FACILITATOR` rows by `user_id`, so no teardown
change is needed. The doc comment on `createCourse` (which cites SPEC-09 §9)
is updated to cite SPEC-01 as the source of the 1:1 contract.

### 2. `test/e2e/courses.spec.ts`

- Every authoring facilitator gets `assignFacilitator(db, facilitator.userId, event.eventId)` after `createUser`.
- New test: "an unassigned facilitator cannot author course content" — create
  a facilitator, do NOT assign them, `POST /api/courses/[id]/modules` → 403,
  and verify no row landed (`MODULE` count for `course.courseId` unchanged).
- New test: "an assigned facilitator can create a course through the API"
  (replacing `test.fixme`). Payload includes `event_id`, and the newly created
  course is pushed to `courses` so teardown deletes it:
  `data: { course_name, course_description, event_id: event.eventId }`.
- Existing non-authoring tests ("the curriculum reads back", "invalid module
  refused", "attendee cannot author", "module delete cascades") keep their
  facilitator-creation; only the assignment line is added. The "attendee
  cannot author" and `GET /api/courses` 403 assertions are unchanged.
- The header comment's SPEC-09 §9 reference is replaced with a note that the
  event-owned contract is per SPEC-01.

### 3. `test/e2e/uploads.spec.ts`

- Drop `course_id` and `module_id` from the four multipart bodies that carry
  them (two `course-asset` uploads, the video-reject, and the attendee-reject).
  Only `file` and `lesson_id` remain.
- The "a missing field is refused" test sends only `file` (no `lesson_id`) —
  keep it exactly so; it now doubles as the regression test for the new
  minimal required-field set.
- The upload fixtures' facilitator is now unassigned, so under SPEC-03 the two
  real upload tests would 403. Call `assignFacilitator` for those facilitators
  (the attendee-reject test must NOT assign, so it keeps asserting 403).
- `createCourse`'s doc comment reference to SPEC-09 §9 is updated per the
  fixture change.

### 4. Dangling SPEC-09 drift references

The old SPEC-09-TEST-STRATEGY §9 (migration file disagrees with the live
database) is a historical document. Where comments cite it specifically about
the course↔event relationship or the `created_by` drift, point them at
SPEC-01/SPEC-02 instead:

- `test/e2e/fixtures.ts` `createCourse` comment.
- `test/e2e/courses.spec.ts` header + fixme replacement comment.
- `src/shared/db/dao/course.dao.ts` `userHasCourseAccess` comment.
- `test/proxy.test.ts` / `events.spec.ts` / `signup.spec.ts` — only if they
  reference §9 about the course schema; otherwise leave them.

### 5. CHANGELOG

Add one entry summarising the ownership change (user-facing: course editing is
now team-based per event, not single-creator).

## Files touched

- `test/e2e/fixtures.ts`
- `test/e2e/courses.spec.ts`
- `test/e2e/uploads.spec.ts`
- `CHANGELOG.md`
- comment-only touches listed in §4

## Verification

- E2E suites pass against a live database (requires
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):
  `pnpm exec playwright test courses uploads`.
- `grep -rn "SPEC-09" test/e2e/ src/shared/db/dao/course.dao.ts` shows only
  intended remaining references (unrelated §9 content).
- Full gates: `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Coverage thresholds are not lowered (ratchet rule).
