# SPEC-09: Code Review Fixes

Resolves issues identified in the SPEC-01–08 code review.

---

## 1. Fix #2 — Remove self-linking "View Course" button

**File:** `src/app/staff/events/[id]/page.tsx`

Delete the `<button>` element that navigates to `/staff/events/${eventId}` — the same page the user is on.

---

## 2. Fix #3 — Delete dead `use-course-detail.ts`

**File:** `src/modules/courses/lib/use-course-detail.ts`

`git rm` and delete. Nothing imports it; uses old broken field names.

---

## 3. Fix #4 — Remove duplicate `isFacilitator`

**File:** `src/app/staff/events/[id]/page.tsx`

- Delete `const isFacilitator = hasMinRole(userRole, "facilitator");`
- Replace `isFacilitator` prop on `OverviewSection` with `isStaff`
- Update `OverviewSection` prop interface to accept `isStaff`

---

## 4. Fix #5 — Skipped per instruction

---

## 5. Fix #6 — Named interface `ModuleWithLessons`

**New file:** `src/modules/courses/lib/types.ts`

```ts
import type { Module, Lesson } from "@/shared/types";

export interface ModuleWithLessons extends Module {
  LESSONS: Lesson[];
}
```

**Update:**
- `src/modules/courses/lib/use-course-create.ts` — import & use `ModuleWithLessons`
- `src/modules/courses/ui/curriculum-builder.tsx` — import & use `ModuleWithLessons`, remove local interface

---

## 6. Fix #7 — Extract shared access-validation helpers

**New file:** `src/modules/courses/lib/course-access.ts`

Export `requireModuleAccess(moduleId, userId, userRole)` and `requireLessonAccess(lessonId, userId, userRole)`. Returns `NextResponse | null` (null = allowed).

**Update:**
- `src/app/api/modules/[id]/route.ts` — use shared `requireModuleAccess`
- `src/app/api/lessons/[id]/route.ts` — use shared `requireLessonAccess`
- `src/app/api/modules/[id]/lessons/route.ts` — use shared `requireLessonAccess`
- `src/app/api/courses/[id]/modules/route.ts` — use shared `requireModuleAccess`

---

## 7. Fix #8 — Remove `as UserRole` cast

**File:** `src/app/api/speakers/me/route.ts`

Remove `as UserRole` on `user.role`. If `requireAuth()` already returns `role: UserRole` via `AuthUser`, the cast is unnecessary. Remove the `UserRole` import too.

---

## 8. Fix #9 — Cascade course deletion

**New migration:** `supabase/migrations/00005_cascade_course_delete.sql`

```sql
ALTER TABLE "COURSE" DROP CONSTRAINT course_created_by_fkey;
ALTER TABLE "COURSE" ADD CONSTRAINT course_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES "USER"(id) ON DELETE CASCADE;
```

(Verify constraint name — may be `COURSE_created_by_fkey`.)

---

## 9. Fix #10 — Parallelize JSON parsing

**File:** `src/modules/events/lib/fetch-event-access.ts`

Replace sequential `if (speakerRes)` / `if (ticketRes)` blocks with a single `Promise.all` for all three JSON parses.

---

## Execution order

1. Delete files: `use-course-detail.ts`
2. Create files: `types.ts`, `course-access.ts`, `00005` migration
3. Edit files: staff event page, use-course-create, curriculum-builder, module/lesson routes, speaker route, fetch-event-access
4. Run `pnpm format && pnpm lint && pnpm typecheck && pnpm test`
