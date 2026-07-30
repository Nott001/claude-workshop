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
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { ModuleType, ContentType } from "@/shared/types";

export default function SpeakerCoursePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { user, loading: sessionLoading } = useSession();
  const userRole = user?.role ?? null;

  const { event: speakerEvent, loading: speakerLoading, error: speakerError } = useSpeakerEvent(eventId);
  const { course, loading: courseLoading } = useCourseByEvent(eventId);
  const courseBuilder = useCourseCreate(eventId);

  const seededRef = useRef(false);

  useEffect(() => {
    if (course && !seededRef.current) {
      const transformedModules: ModuleWithLessons[] = course.MODULE.map((m) => ({
        id: m.id,
        course_id: m.course_id,
        module_name: m.module_name,
        sequence_order: m.sequence_order,
        module_type: m.module_type as ModuleType,
        is_locked: m.is_locked,
        created_at: "",
        updated_at: "",
        LESSONS: m.LESSON.map((l) => ({
          id: l.id,
          module_id: l.module_id,
          description: l.description,
          content_type: l.content_type as ContentType,
          content_url: l.content_url,
          sequence_order: l.sequence_order,
          created_at: "",
          updated_at: "",
        })),
      }));
      courseBuilder.setModules(transformedModules);
      seededRef.current = true;
    }
  }, [course, courseBuilder]);

  useEffect(() => {
    if (!sessionLoading && !hasMinRole(userRole, "speaker")) {
      router.replace("/speaker/dashboard");
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

  async function handleAddModule() {
    if (course) {
      const order = courseBuilder.modules.filter((m) => m.module_type !== "qa").length + 1;
      const res = await fetch(`/api/courses/${course.id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_name: `Module ${order}`,
          sequence_order: courseBuilder.modules.length + 1,
        }),
      });
      if (!res.ok) return undefined;
      const mod = await res.json();
      courseBuilder.setModules([...courseBuilder.modules, { ...mod, LESSONS: [] }]);
      return mod.id;
    }
    return courseBuilder.handleAddModule();
  }

  async function handleAddQaModule() {
    if (course) {
      const res = await fetch(`/api/courses/${course.id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_name: "Q&A",
          sequence_order: courseBuilder.modules.length + 1,
          module_type: "qa",
        }),
      });
      if (!res.ok) return undefined;
      const mod = await res.json();
      courseBuilder.setModules([...courseBuilder.modules, { ...mod, LESSONS: [] }]);
      return mod.id;
    }
    return courseBuilder.handleAddQaModule();
  }

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
              onClick={() => handleAddModule()}
              className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80"
            >
              Create Course
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-6">
            <CurriculumBuilder
              modules={courseBuilder.modules}
              onAddModule={handleAddModule}
              onAddQaModule={handleAddQaModule}
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
