"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useSeededCourseBuilder } from "@/modules/courses/lib/use-seeded-course-builder";
import { ManageCoursePage } from "@/modules/courses/components/manage-course-page";
import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";

export default function SpeakerCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { allowed: isSpeaker, pending: sessionPending } = useRoleGuard(ROLES.SPEAKER);

  const { event: speakerEvent, loading: speakerLoading, error: speakerError } = useSpeakerEvent(eventId);
  const { speakers, loading: speakersLoading } = useAssignedSpeakers(eventId);
  const { builder: courseBuilder, loading: courseLoading } = useSeededCourseBuilder(eventId);

  useEffect(() => {
    if (speakerLoading || sessionPending) return;
    if (speakerError || !speakerEvent) {
      router.replace(`/speaker/events/${eventId}?error=not_assigned`);
    }
  }, [speakerLoading, sessionPending, speakerError, speakerEvent, eventId, router]);

  const loading = sessionPending || speakerLoading || speakersLoading || courseLoading;
  // Nothing to draw for a reader the effect above is already redirecting.
  if (!loading && (!isSpeaker || speakerError || !speakerEvent)) return null;

  return (
    <ManageCoursePage
      loading={loading}
      backHref={`/speaker/events/${eventId}`}
      builder={courseBuilder}
      speakers={speakers}
      eventStartTime={speakerEvent?.start_time}
      eventEndTime={speakerEvent?.end_time}
    />
  );
}
