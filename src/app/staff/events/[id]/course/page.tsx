"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useSeededCourseBuilder } from "@/modules/courses/lib/use-seeded-course-builder";
import { ManageCoursePage } from "@/modules/courses/components/manage-course-page";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";
import { useEvent } from "@/modules/events/lib/use-event";

export default function StaffEventCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { pending: sessionPending, allowed: isStaff } = useRoleGuard(ROLES.FACILITATOR);

  const { event, loading: eventLoading, error: eventError } = useEvent(eventId, { enabled: !sessionPending && isStaff });
  const { speakers, loading: speakersLoading } = useAssignedSpeakers(eventId);
  const { builder: courseBuilder, loading: courseLoading } = useSeededCourseBuilder(eventId);

  useEffect(() => {
    if (sessionPending) return;
    // A denied reader and an event that will not load both belong back on the
    // list; the hook does not run its fetch for the first of those.
    if (!isStaff || eventError) router.replace("/staff/events");
  }, [sessionPending, isStaff, eventError, router]);

  const loading = sessionPending || eventLoading || speakersLoading || courseLoading;
  // Nothing to draw for a reader the effect above is already redirecting.
  if (!loading && (!isStaff || !event)) return null;

  return (
    <ManageCoursePage
      loading={loading}
      backHref={`/staff/events/${eventId}`}
      builder={courseBuilder}
      speakers={speakers}
      eventStartTime={event?.start_time}
      eventEndTime={event?.end_time}
    />
  );
}
