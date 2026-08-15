"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { CourseBuilderSection } from "@/modules/courses/components/course-builder-section";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";
import type { Event } from "@/shared/types";
import { BackLink } from "@/shared/components/back-link";

export default function StaffEventCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { pending: sessionPending, allowed: isStaff } = useRoleGuard(ROLES.FACILITATOR);

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const { speakers, loading: speakersLoading } = useAssignedSpeakers(eventId);
  const { course, loading: courseLoading } = useCourseByEvent(eventId);
  const courseBuilder = useCourseCreate(eventId, course?.id);

  const seededRef = useRef(false);

  useEffect(() => {
    if (course && !seededRef.current) {
      courseBuilder.setModules(course.MODULE);
      seededRef.current = true;
    }
  }, [course, courseBuilder]);

  useEffect(() => {
    if (sessionPending) return;
    if (!isStaff) {
      router.replace("/staff/events");
      return;
    }

    fetch(`/api/events/${eventId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setEvent(data);
        setEventLoading(false);
      })
      .catch(() => {
        router.replace("/staff/events");
      });
  }, [eventId, sessionPending, isStaff, router]);

  if (sessionPending || eventLoading || speakersLoading || courseLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!isStaff || !event) return null;

  const noCourse = !course && courseBuilder.modules.length === 0;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <BackLink href={`/staff/events/${eventId}`} className="mb-8">
          Back to event
        </BackLink>

        <h1 className="mb-8 text-[32px] font-bold tracking-[-0.02em] text-fg">Manage Course</h1>

        <div className="rounded-xl border border-border bg-surface p-6">
          <CourseBuilderSection
            builder={courseBuilder}
            eventSpeakers={speakers}
            eventStartTime={event.start_time}
            eventEndTime={event.end_time}
          />
        </div>
      </div>
    </div>
  );
}
