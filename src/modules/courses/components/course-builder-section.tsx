"use client";

import { CurriculumBuilder } from "@/modules/courses/components/curriculum-builder";
import { Button } from "@/shared/components/button";
import { BUILDER_SURFACE } from "@/modules/courses/lib/surface";
import type { CourseSpeaker } from "@/modules/courses/lib/types";
import type { useCourseCreate } from "@/modules/courses/lib/use-course-create";

/** The wiring `useCourseCreate` hands the builder. */
export type CourseBuilder = ReturnType<typeof useCourseCreate>;

export function CourseBuilderSection({
  builder,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
}: {
  builder: CourseBuilder;
  eventSpeakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}) {
  // Both states carry their own card so a host page only has to place the
  // section, never wrap it — two surfaces nested read as a bug.
  if (builder.modules.length === 0) {
    return (
      <div className={BUILDER_SURFACE}>
        <p className="text-sm text-muted-fg">No course yet for this event.</p>
        {builder.error && <p className="mt-3 text-sm text-error">{builder.error}</p>}
        <Button className="mt-4" onClick={() => builder.handleAddModule()}>
          Create Course
        </Button>
      </div>
    );
  }

  return (
    <>
      {builder.error && <p className="mb-4 text-sm text-error">{builder.error}</p>}
      <CurriculumBuilder
        modules={builder.modules}
        eventSpeakers={eventSpeakers}
        eventStartTime={eventStartTime}
        eventEndTime={eventEndTime}
        onAddModule={builder.handleAddModule}
        onAddQaModule={builder.handleAddQaModule}
        onDeleteModule={builder.handleDeleteModule}
        onReorderModules={builder.handleReorderModules}
        onMoveLesson={builder.handleMoveLesson}
        onSaveModule={builder.handleSaveModule}
      />
    </>
  );
}
