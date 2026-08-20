"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BackLink } from "@/shared/components/back-link";
import { RoomLessonRow } from "@/modules/courses/components/room-lesson-row";
import { useCourseContent } from "@/modules/courses/lib/use-course-content";

/**
 * A course read on the reader's own time.
 *
 * Deliberately not the room with its live parts switched off. The session is
 * over by the time anyone reads here, so there is no clock, no live pill, no
 * highlight to follow and no Q&A — that last one because its read policy wants
 * a live session behind it (`qa_message_visible`, migration 00004), and a
 * panel nobody is watching is worse than no panel. What remains is the
 * material, which is what was released.
 */
export function SelfPacedCoursePage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { access, course, releasedModuleIds } = useCourseContent(courseId);

  if (access === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading course...</div>
      </div>
    );
  }

  if (access !== "allowed" || !course) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <span aria-hidden className="material-symbols-rounded text-4xl text-muted-fg/50">
            lock
          </span>
          <p className="mt-3 text-sm font-semibold text-fg">This course is not open to you.</p>
          <p className="mt-1 text-sm text-muted-fg">Course material opens to the people who held a ticket to its event.</p>
          <Link
            href="/courses"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/80"
          >
            My courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <BackLink href="/courses" className="mb-6">
          Back to My Courses
        </BackLink>

        <h1 className="text-xl font-bold text-fg">{course.course_name}</h1>
        {course.course_description && <p className="mt-1 text-sm text-muted-fg">{course.course_description}</p>}

        <div className="mt-6 flex flex-col gap-3">
          {course.MODULE.filter((mod) => mod.module_type !== "qa").map((mod) => (
            <section key={mod.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">{mod.module_name}</h2>
                {releasedModuleIds.includes(mod.id) && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
                    <span aria-hidden className="material-symbols-rounded text-[12px]">
                      lock_open
                    </span>
                    After the event
                  </span>
                )}
              </div>
              {mod.LESSONS.length === 0 ? (
                <p className="mt-2 text-xs text-muted-fg">No material in this module.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {mod.LESSONS.map((lesson) => (
                    <RoomLessonRow
                      key={lesson.id}
                      lesson={lesson}
                      isHighlighted={false}
                      isStaff={false}
                      settingHighlight={false}
                      onToggleHighlight={() => {}}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
