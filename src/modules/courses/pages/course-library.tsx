"use client";

import Link from "next/link";
import { useCourseLibrary } from "@/modules/courses/lib/use-course-library";
import { CourseSummaryCard } from "@/modules/courses/components/course-summary-card";

/**
 * The after-event material an attendee has been given, in one place.
 *
 * The listing is the whole reason a release is visible: once an event is over
 * its page is the last thing anyone revisits, and its room shows a session
 * that has ended — so without this the material would sit behind a door
 * nobody has a reason to open.
 */
export function CourseLibraryPage() {
  const { courses, loading, error } = useCourseLibrary();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading your courses...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
            <span aria-hidden className="material-symbols-rounded text-2xl text-brand">
              school
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">My Courses</h1>
            <p className="mt-0.5 text-sm text-muted-fg">Material your events released once they finished.</p>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted p-12 text-center">
            <span aria-hidden className="material-symbols-rounded text-4xl text-muted-fg/50">
              school
            </span>
            <h2 className="mt-4 text-sm font-semibold text-fg">Nothing unlocked yet</h2>
            <p className="mt-1 text-xs text-muted-fg">
              Material appears here once an event you attended has finished and released it.
            </p>
            {/* The sentence above reads as a promise on its own, and an attendee
                whose event finished and released nothing is left wondering
                whether the page is broken or the material is still coming.
                "after it ends" is the load-bearing half: an event can run a
                course during the session and keep none of it back, so having
                had material is not the same as having material to release. */}
            <p className="mt-1 text-xs text-muted-fg">Not every event has material to release after it ends.</p>
            <Link
              href="/events"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/80"
            >
              <span aria-hidden className="material-symbols-rounded text-sm">
                event
              </span>
              Browse events
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {courses.map((course) => (
              <CourseSummaryCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
