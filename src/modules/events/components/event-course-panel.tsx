"use client";

import Link from "next/link";
import { ROLES } from "@/shared/lib/roles";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { buttonStyles } from "@/shared/components/button";
import { SectionCard } from "@/shared/components/section-card";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import type { UserRole } from "@/shared/types";

export function EventCoursePanel({
  eventId,
  userRole,
  canManageCourse,
}: {
  eventId: string;
  userRole: UserRole | null;
  canManageCourse: boolean;
}) {
  const { course, loading } = useCourseByEvent(eventId);
  const isStaff = hasMinRole(userRole, ROLES.FACILITATOR);

  if (loading) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm text-muted-fg">Loading course...</p>
      </SectionCard>
    );
  }

  if (course) {
    const totalLessons = course.MODULE.reduce((sum, m) => sum + m.LESSONS.length, 0);

    return (
      <SectionCard title="Course" icon="school">
        <p className="text-sm font-semibold text-fg">{course.course_name}</p>
        {course.course_description && <p className="mt-1 text-sm text-muted-fg">{course.course_description}</p>}
        <p className="mt-3 text-xs text-muted-fg">
          {course.MODULE.length} module{course.MODULE.length !== 1 ? "s" : ""} &middot; {totalLessons} lesson
          {totalLessons !== 1 ? "s" : ""}
        </p>

        {canManageCourse && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/staff/events/${eventId}/course`} className={buttonStyles()}>
              Manage Course
            </Link>
            <Link href={`/courses/${course.id}/room`} className={buttonStyles({ variant: "secondary" })}>
              Enter Course Room
            </Link>
          </div>
        )}
      </SectionCard>
    );
  }

  if (canManageCourse) {
    return (
      <SectionCard title="Course" icon="school">
        <p className="mb-4 text-sm text-muted-fg">No course yet for this event.</p>
        <Link href={`/staff/events/${eventId}/course`} className={buttonStyles()}>
          Create Course
        </Link>
      </SectionCard>
    );
  }

  if (!isStaff) return null;

  return (
    <SectionCard title="Course" icon="school">
      <p className="text-sm text-muted-fg">Waiting for the speaker to create a course for this event.</p>
    </SectionCard>
  );
}
