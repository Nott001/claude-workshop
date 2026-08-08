"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { CourseBuilderSection } from "@/modules/courses/components/course-builder-section";
import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";

export default function SpeakerCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { allowed: isSpeaker, pending: sessionPending } = useRoleGuard("speaker");

  const { event: speakerEvent, loading: speakerLoading, error: speakerError } = useSpeakerEvent(eventId);
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
    if (speakerLoading || sessionPending) return;
    if (speakerError || !speakerEvent) {
      router.replace(`/speaker/event/${eventId}?error=not_assigned`);
    }
  }, [speakerLoading, sessionPending, speakerError, speakerEvent, eventId, router]);

  if (sessionPending || speakerLoading || speakersLoading || courseLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!isSpeaker) return null;

  if (speakerError || !speakerEvent) return null;

  const noCourse = !course && courseBuilder.modules.length === 0;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <Link
          href={`/speaker/event/${eventId}`}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-fg transition-colors hover:text-fg"
        >
          <span className="material-symbols-rounded text-base">arrow_back</span>
          Back to event
        </Link>

        <h1 className="mb-8 text-[32px] font-bold tracking-[-0.02em] text-fg">Manage Course</h1>

        {noCourse ? (
          <div className="rounded-xl border border-border bg-surface p-8">
            <CourseBuilderSection
              builder={courseBuilder}
              eventSpeakers={speakers}
              eventStartTime={speakerEvent.start_time}
              eventEndTime={speakerEvent.end_time}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <CourseBuilderSection
              builder={courseBuilder}
              eventSpeakers={speakers}
              eventStartTime={speakerEvent.start_time}
              eventEndTime={speakerEvent.end_time}
            />
          </div>
        )}
      </div>
    </div>
  );
}
