"use client";

import { BackLink } from "@/shared/components/back-link";
import { StaffPage, StaffPageHeader, StaffPageSkeleton } from "@/shared/components/staff-page";
import { CourseBuilderSection, type CourseBuilder } from "./course-builder-section";
import type { CourseSpeaker } from "../lib/types";

/**
 * The Manage Course screen, shared by the staff and speaker routes.
 *
 * The two differ only in where Back goes and which hook loaded the event, so
 * everything else lived twice — which is how one of them ended up wrapping the
 * builder in a second card the other did not have. Each route now owns its auth
 * and its data; the screen itself has one definition.
 *
 * It sits in `StaffPage` like every other staff screen. It used to measure its
 * own column — `px-16 pt-24` and no maximum width at all — so on a wide display
 * the curriculum stretched the full viewport while the event page it is reached
 * from stopped at 1360px, and stepping between them moved every control.
 */
export function ManageCoursePage({
  loading = false,
  backHref,
  builder,
  speakers,
  eventStartTime,
  eventEndTime,
}: {
  /** Each route waits on a different set of hooks; the gate itself is one. */
  loading?: boolean;
  backHref: string;
  builder: CourseBuilder;
  speakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}) {
  if (loading) {
    return <StaffPageSkeleton />;
  }

  return (
    <StaffPage>
      <BackLink href={backHref} className="mb-6">
        Back to event
      </BackLink>

      <StaffPageHeader title="Manage Course" description="Build the curriculum this event's room runs on." />

      <CourseBuilderSection
        builder={builder}
        eventSpeakers={speakers}
        eventStartTime={eventStartTime}
        eventEndTime={eventEndTime}
      />
    </StaffPage>
  );
}
