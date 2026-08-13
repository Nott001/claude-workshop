"use client";

import { CurriculumBuilder } from "@/modules/courses/components/curriculum-builder";
import { LessonDialog } from "@/modules/courses/components/lesson-dialog";
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
  if (builder.modules.length === 0) {
    return (
      <>
        <p className="text-sm text-muted-fg">No course yet for this event.</p>
        {builder.error && <p className="mt-3 text-sm text-error">{builder.error}</p>}
        <button
          onClick={() => builder.handleAddModule()}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
        >
          Create Course
        </button>
      </>
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
        onUpdateModuleSchedule={builder.handleUpdateModuleSchedule}
        onAddModule={builder.handleAddModule}
        onAddQaModule={builder.handleAddQaModule}
        onRenameModule={builder.handleRenameModule}
        onDeleteModule={builder.handleDeleteModule}
        onDeleteLesson={builder.handleDeleteLesson}
        onAddLessonClick={builder.openLessonDialog}
        onReorderModules={builder.handleReorderModules}
        onMoveLesson={builder.handleMoveLesson}
        onRenameLesson={builder.handleRenameLesson}
      />
      <LessonDialog
        open={builder.lessonDialogModuleId !== null}
        onOpenChange={(open) => {
          if (!open) builder.setLessonDialogModuleId(null);
        }}
        onAddLesson={builder.handleAddLesson}
      />
    </>
  );
}
