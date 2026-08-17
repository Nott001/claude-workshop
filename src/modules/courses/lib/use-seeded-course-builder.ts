"use client";

import { useEffect, useRef } from "react";
import { useCourseByEvent } from "./use-course-by-event";
import { useCourseCreate } from "./use-course-create";

/**
 * Load an event's course and hand back a builder already primed with it.
 *
 * The seeding is once-only on purpose: the builder owns the modules from then
 * on, and re-seeding on every change to `course` would throw away edits the
 * reader had made. Both Manage Course pages need exactly this, and having each
 * spell it out is how they drift.
 */
export function useSeededCourseBuilder(eventId: string) {
  const { course, loading } = useCourseByEvent(eventId);
  const builder = useCourseCreate(eventId, course?.id);
  const seededRef = useRef(false);

  useEffect(() => {
    if (course && !seededRef.current) {
      builder.setModules(course.MODULE);
      seededRef.current = true;
    }
  }, [course, builder]);

  return { builder, course, loading };
}
