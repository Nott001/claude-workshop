"use client";

import { BackLink } from "@/shared/components/back-link";
import { CourseBuilderSection, type CourseBuilder } from "./course-builder-section";
import type { CourseSpeaker } from "../lib/types";

/**
 * The Manage Course screen, shared by the staff and speaker routes.
 *
 * The two differ only in where Back goes and which hook loaded the event, so
 * everything else lived twice — which is how one of them ended up wrapping the
 * builder in a second card the other did not have. Each route now owns its auth
 * and its data; the screen itself has one definition.
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
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <BackLink href={backHref} className="mb-8">
          Back to event
        </BackLink>

        <h1 className="mb-8 text-[32px] font-bold tracking-[-0.02em] text-fg">Manage Course</h1>

        <CourseBuilderSection
          builder={builder}
          eventSpeakers={speakers}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
        />
      </div>
    </div>
  );
}
