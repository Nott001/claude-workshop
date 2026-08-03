"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/shared/components/footer";
import { useSession } from "@/modules/auth";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { CurriculumBuilder } from "@/modules/courses/ui/curriculum-builder";
import { LessonDialog } from "@/modules/courses/ui/lesson-dialog";
import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";

export default function SpeakerCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { user, loading: sessionLoading } = useSession();
  const userRole = user?.role ?? null;

  const { event: speakerEvent, loading: speakerLoading, error: speakerError } = useSpeakerEvent(eventId);
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
    if (!sessionLoading && !hasMinRole(userRole, "speaker")) {
      router.replace("/access-denied");
    }
  }, [sessionLoading, userRole, router]);

  useEffect(() => {
    if (!speakerLoading && !sessionLoading) {
      if (speakerError || !speakerEvent) {
        router.replace(`/speaker/event/${eventId}?error=not_assigned`);
      }
    }
  }, [speakerLoading, sessionLoading, speakerError, speakerEvent, eventId, router]);

  if (sessionLoading || speakerLoading || courseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!hasMinRole(userRole, "speaker")) return null;

  if (speakerError || !speakerEvent) return null;

  const noCourse = !course && courseBuilder.modules.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
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
            <p className="text-sm text-muted-fg">No course yet for this event.</p>
            <button
              onClick={() => courseBuilder.handleAddModule()}
              className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
            >
              Create Course
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <CurriculumBuilder
              modules={courseBuilder.modules}
              onAddModule={courseBuilder.handleAddModule}
              onAddQaModule={courseBuilder.handleAddQaModule}
              onRenameModule={courseBuilder.handleRenameModule}
              onDeleteModule={courseBuilder.handleDeleteModule}
              onDeleteLesson={courseBuilder.handleDeleteLesson}
              onAddLessonClick={courseBuilder.openLessonDialog}
              onReorderModules={courseBuilder.handleReorderModules}
              onReorderLessons={courseBuilder.handleReorderLessons}
              onToggleModuleLock={courseBuilder.handleToggleModuleLock}
            />
            <LessonDialog
              open={courseBuilder.lessonDialogModuleId !== null}
              onOpenChange={(open) => {
                if (!open) courseBuilder.setLessonDialogModuleId(null);
              }}
              onAddLesson={courseBuilder.handleAddLesson}
            />
          </div>
        )}
      </div>
      <Footer role="speaker" />
    </div>
  );
}
