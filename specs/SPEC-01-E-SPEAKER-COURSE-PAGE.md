# SPEC-01-E — Speaker Course Page

Prerequisites: SPEC-01-D
After this: (none — final spec in the sequence)

> **As built.** The role check uses `useRoleGuard("speaker")`, so a failing role
> redirects to `/access-denied` rather than to `/speaker/dashboard`. The
> assignment check is as specified: it redirects to
> `/speaker/event/[eventId]?error=not_assigned`. The "Known issue" below still
> holds — `EVENT.course_id` is dead, so the event page always reads "Build
> Course".

## Scope

1 new file + 1 file update. Create a standalone course management page for
speakers under `/speaker/event/[eventId]/course` and update the speaker event
detail page to link to it.

## Background

Before this series of specs, a speaker who wanted to manage their course
clicked "Manage Course" on their event detail page, which linked to
`/staff/events/[eventId]`. Since SPEC-01-B now blocks all speakers from
`/staff/*`, that link was dead. SPEC-01-A already removed the "Events" nav
item from the speaker's navbar.

This spec gives speakers their own course management page, so they regain the
ability to create and edit courses for their assigned events.

## Changes

### 1. Create `src/app/speaker/event/[eventId]/course/page.tsx`

A client component that reuses existing course-management hooks and components.

**Route guard:**

1. The user must be signed in.
2. The user's role must be `speaker` or higher (use `hasMinRole`).
3. The user must be assigned as a speaker to this event.

If the role check fails, redirect to `/speaker/dashboard`. If the assignment
check fails, redirect to `/speaker/event/[eventId]` with an error message.

**Content:**

Reuse the same hooks and components already used in the `CourseSection` of
`src/app/staff/events/[id]/page.tsx`:

- `useCourseByEvent(eventId)` from `@/modules/courses/lib/use-course-by-event`
- `useCourseCreate(eventId)` from `@/modules/courses/lib/use-course-create`
- `CurriculumBuilder` from `@/modules/courses/ui/curriculum-builder`
- `LessonDialog` from `@/modules/courses/ui/lesson-dialog`
- `useSpeakerEvent(eventId)` from `@/modules/events/lib/use-speaker-event` for
  the assignment check.

The page should cover three states:

| State                      | What to render                                           |
| -------------------------- | -------------------------------------------------------- |
| No course exists yet       | "No course yet for this event." + "Create Course" button |
| Course exists, no modules  | Empty `CurriculumBuilder` with "Add Module"              |
| Course exists with modules | Full `CurriculumBuilder` + `LessonDialog`                |

**Layout:**

- Full-page layout with a "Back to event" link to `/speaker/event/[eventId]`.
- Page title: "Manage Course".
- Footer with `role="speaker"`.
- The `Navbar` renders normally (the path does not match `HIDE_NAVBAR_PATHS`).
  The speaker nav shows only "Dashboard".

**Key detail — API gate:**

The `POST /api/courses` endpoint already allows `speaker`+ (unchanged from
SPEC-01-D), and if the user is not `facilitator`+, it checks speaker
assignment (see `src/app/api/courses/route.ts` line 35-44). So the API will
reject a speaker who is not assigned to the event. The page guard is the
first line; the API is the second.

### 2. Update `src/app/speaker/event/[eventId]/page.tsx`

Find the two links that point to `/staff/events/${eventId}`:

- Line 133: "Manage Course" link
- Line 141: "Build Course" link

Change both to point to `/speaker/event/${eventId}/course` instead.

## Dependencies

No new dependencies. All hooks and components are already in the codebase.

## Known issue — schema mismatch on `event.course_id`

The speaker event detail page (`/speaker/event/[eventId]/page.tsx`) decides
whether to show "Manage Course" or "Build Course" based on `event.course_id`.
From SPEC-09 (§9, "Open — the migration file does not match the database"):

|      | Migration file             | Live database             |
| ---- | -------------------------- | ------------------------- |
| Link | `EVENT.course_id → COURSE` | `COURSE.event_id → EVENT` |

The column `EVENT.course_id` does not exist in the live database, so
`event.course_id` is always `undefined/null` and the "Build Course" link is
always shown, even when a course already exists.

This is a pre-existing defect, not introduced by this spec. If the schema is
reconciled (see SPEC-09), the speaker event page will correctly show "Manage
Course" when a course exists. No change is needed in this spec — just be aware
that initially the link will always say "Build Course" until the schema is
fixed.

## Verification

- Sign in as a `speaker` assigned to an event → navigate to
  `/speaker/event/[eventId]/course` → see the course management UI.
- Click "Manage Course" from `/speaker/event/[eventId]` → lands on the new
  page.
- Create a module, add a lesson, reorder — all work.
- Sign in as an unassigned `speaker` → navigate to the course page →
  redirected to `/speaker/event/[eventId]` with error.
