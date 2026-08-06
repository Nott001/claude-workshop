# SPEC-01 — Course Ownership: the Event Owns the Course

Prerequisites: (none — first spec in the sequence)
After this: SPEC-02

## Scope

1 new migration + 1 type change. Drop the single-owner column from `COURSE`
and restate the 1:1 course↔event contract that replaces it. The event owns the
course; who may edit it is decided by assignment to that event (SPEC-02).

## Background

`COURSE.created_by` records which single user created the course, and every
course-mutation API currently authorises against it (see `course-access.ts`
and `api/courses/[id]/route.ts`). That model contradicts where the app is
heading: a course is managed by the team assigned to its event — multiple
speakers and facilitators — not by one creator. This series removes
`created_by` and switches authorisation to event assignment.

Two facts make the drop safe:

- The live schema already owns the relationship the other way:
  `COURSE.event_id INT NOT NULL UNIQUE REFERENCES "EVENT"(id) ON DELETE CASCADE`
  (migration 00004). A course always belongs to exactly one event; an event has
  at most one course; an event may exist with no course. No schema change is
  needed for the contract itself — only for removing the obsolete column.
- Creation attribution survives in the audit log. `POST /api/courses` writes a
  `course.created` event keyed to `actor_id` (see `api/courses/route.ts`), so
  "who made this" is still answerable without a column on the table.

`created_by` is a plain nullable FK (migration 00001). Migration 00005 rebuilt
it with `ON DELETE CASCADE`; the column drop in this spec supersedes that
constraint entirely.

## Changes

### 1. New migration `supabase/migrations/00009_course_event_owned.sql`

```sql
ALTER TABLE "COURSE" DROP COLUMN created_by;
```

Dropping the column also drops `COURSE_created_by_fkey`. No `CASCADE`-style
data migration is needed: no other table references `COURSE.created_by`, and
the audit log carries its own `actor_id`.

### 2. Remove `created_by` from the `Course` type

In `src/shared/types.ts`, delete the `created_by: number | null;` member from
the `Course` interface (around line 24).

## Contract restated (all subsequent specs build on this)

| Claim                                                  | Where it lives                            |
| ------------------------------------------------------ | ----------------------------------------- |
| A course always belongs to exactly one event           | `COURSE.event_id NOT NULL UNIQUE` (00004) |
| An event has at most one course                        | same `UNIQUE`                             |
| An event may exist with no course                      | `EVENT` has no course FK                  |
| Deleting an event deletes its course                   | `ON DELETE CASCADE` (00004)               |
| "Who can edit" = assignment to the event, not creation | SPEC-02                                   |
| "Who created it" = `AUDIT_LOG.course.created`          | `api/courses/route.ts`                    |
| Admin/super_admin always reach any course              | SPEC-02                                   |

## Files touched

- `supabase/migrations/00009_course_event_owned.sql` (new)
- `src/shared/types.ts` (`Course.created_by` removed)

## Verification

- `pnpm typecheck` passes.
- `test/course-content.test.ts` and any other Course literals drop `created_by`.
- `grep -rn "created_by" src/` finds no reference to a `Course` field (the
  audit-log event string `course.created` is unrelated and stays).
- No migration is edited; 00009 is additive.

## Known downstream fallout (fixed in later specs)

- `course.dao.ts`: `findCourseOwner`, `CourseWithEvent.creator_name`,
  `createCourse`'s `created_by` input — SPEC-02.
- `course-access.ts` and `api/courses/[id]/route.ts` `created_by` checks —
  SPEC-02/SPEC-03.
- `staff/courses/page.tsx` "Created By" column — SPEC-05.
- These references will fail typecheck after this spec; SPEC-02 must land
  before committing, or the intermediate state must be a single commit
  covering both.
