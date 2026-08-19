import Link from "next/link";
import type { CourseSummary } from "@/shared/db/dao/course.dao";
import { formatEventDate } from "@/shared/lib/date-utils";

/** "3 modules · 12 lessons" — counted over the released modules only, since
 * those are the ones the card leads to. */
function countsLabel(course: CourseSummary): string {
  const modules = course.MODULE.length;
  const lessons = course.MODULE.reduce((sum, mod) => sum + mod.LESSON.length, 0);
  return `${modules} module${modules === 1 ? "" : "s"} · ${lessons} lesson${lessons === 1 ? "" : "s"}`;
}

/**
 * One course in a listing. The whole card is the link — a course has exactly
 * one thing to do with it, so a separate "open" control would only add a
 * second target for the same destination.
 */
export function CourseSummaryCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/10">
          <span aria-hidden className="material-symbols-rounded text-[20px] text-brand">
            school
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-fg">{course.course_name}</h2>
          {course.course_description && <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{course.course_description}</p>}
          <p className="mt-2 text-xs text-muted-fg">
            {countsLabel(course)}
            {course.EVENT && ` · from ${course.EVENT.title}, ${formatEventDate(course.EVENT.event_date)}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
