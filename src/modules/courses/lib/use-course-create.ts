"use client";

// The only coupling to the events module is the eventId scope parameter feeding
// event_id into POST /api/courses — the 1:1 contract from SPEC-01. Keep it that
// way: anything else a course author does is owned by this module.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getUploadEndpoint, uploadBucket } from "@/modules/courses/lib/lesson-utils";
import { postUpload } from "@/shared/integrations/storage/upload-client";
import { planDraft, planIsEmpty, type ModuleDraft } from "./module-draft";
import type { ModuleWithLessons } from "./types";
import type { LessonMove } from "./reorder";

/**
 * Routes answer with `{ error: string }` for a refusal the caller can act on and
 * `{ error: { message } }` elsewhere. Reading only the latter turned a 409 into
 * a generic failure, which told the author nothing about what to do next.
 */
async function refusalMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const error = body?.error;
  if (typeof error === "string") return error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export function useCourseCreate(eventId: string, existingCourseId?: number) {
  const router = useRouter();

  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [modules, setModules] = useState<ModuleWithLessons[]>([]);

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: courseName,
        course_description: courseDescription || null,
        event_id: Number(eventId),
      }),
    });

    if (!res.ok) {
      setError(await refusalMessage(res, "Failed to create course"));
      setSubmitting(false);
      return;
    }

    const course = await res.json();
    router.push(`/courses/${course.id}`);
  }

  async function ensureCourseCreated(): Promise<number | null> {
    if (modules.length > 0) {
      return modules[0].course_id;
    }

    if (existingCourseId) {
      return existingCourseId;
    }

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: courseName || "Untitled Course",
        course_description: courseDescription || null,
        event_id: Number(eventId),
      }),
    });

    if (!res.ok) {
      setError(await refusalMessage(res, "Failed to create course"));
      return null;
    }

    const course = await res.json();
    setCourseName(course.course_name);
    return course.id;
  }

  async function handleAddModule(): Promise<number | undefined> {
    const courseId = await ensureCourseCreated();
    if (!courseId) return;

    const order = modules.filter((m) => m.module_type !== "qa").length + 1;
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: `Module ${order}`, sequence_order: modules.length + 1 }),
    });
    if (!res.ok) return;
    const mod = await res.json();
    setModules((prev) => [...prev, { ...mod, LESSONS: [] }]);
    return mod.id;
  }

  async function handleAddQaModule(): Promise<number | undefined> {
    const courseId = await ensureCourseCreated();
    if (!courseId) return;

    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_name: "Q&A",
        sequence_order: modules.length + 1,
        module_type: "qa",
      }),
    });
    if (!res.ok) return;
    const mod = await res.json();
    setModules((prev) => [...prev, { ...mod, LESSONS: [] }]);
    return mod.id;
  }

  async function handleDeleteModule(moduleId: number) {
    if (!confirm("Delete this module and all its content?")) return;
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) return;
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }

  async function handleReorderModules(reordered: ModuleWithLessons[]) {
    setModules(reordered);
    await Promise.all(
      reordered.map((m) =>
        fetch(`/api/modules/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module_name: m.module_name,
            sequence_order: m.sequence_order,
            // The reorder swap keeps the DB's "HH:MM:SS" values in state; the
            // API validates "HH:MM", so trim before sending like the schedule
            // picker does.
            start_time: m.start_time?.slice(0, 5) ?? null,
            end_time: m.end_time?.slice(0, 5) ?? null,
            speaker_profile_id: m.speaker_profile_id,
          }),
        }),
      ),
    );
  }

  async function handleMoveLesson(nextModules: ModuleWithLessons[], updates: LessonMove[]) {
    setModules(nextModules);
    await Promise.all(
      updates.map((u) => {
        const lesson = nextModules.find((m) => m.id === u.module_id)?.LESSONS.find((l) => l.id === u.id);
        if (!lesson) return Promise.resolve();
        return fetch(`/api/lessons/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: lesson.name,
            content_type: lesson.content_type,
            content_url: lesson.content_url ?? undefined,
            sequence_order: u.sequence_order,
            module_id: u.module_id,
          }),
        });
      }),
    );
  }

  /** Storage posts need the lesson's whole path, not just its id. */
  async function uploadMaterial(lessonId: number, moduleId: number, contentType: string, file: File) {
    const endpoint = getUploadEndpoint(contentType);
    const bucket = uploadBucket(contentType);
    if (!endpoint || !bucket) return null;

    const result = await postUpload(bucket, endpoint, file, {
      lesson_id: String(lessonId),
      course_id: String(modules[0]?.course_id ?? ""),
      module_id: String(moduleId),
    });
    return result.ok ? null : result.error;
  }

  /**
   * Re-read the course rather than patch state from each response: a save is a
   * batch, and rebuilding local state from six partial answers is how the two
   * drift. One read after the batch is also one read, not six.
   */
  async function reloadModules() {
    const res = await fetch(`/api/courses/event/${eventId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data?.MODULE)) setModules(data.MODULE);
  }

  /**
   * Apply a module's whole edit in one go. Order matters: deletes and material
   * drops run before creates and uploads, so a lesson can shed one file and
   * gain another in the same save without the drop landing on the new url.
   *
   * The first refusal stops the batch and is returned verbatim. Writes already
   * made are not rolled back — the reload that follows shows exactly how far it
   * got, which is more honest than a rollback that could fail in turn.
   */
  async function handleSaveModule(draft: ModuleDraft): Promise<string | null> {
    const mod = modules.find((m) => m.id === draft.moduleId);
    if (!mod) return "Module not found";

    const plan = planDraft(mod, draft);
    if (planIsEmpty(plan)) return null;

    if (plan.modulePatch) {
      const res = await fetch(`/api/modules/${mod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...plan.modulePatch, sequence_order: mod.sequence_order }),
      });
      if (!res.ok) return refusalMessage(res, "Failed to save the module");
    }

    for (const lessonId of plan.deletes) {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      if (!res.ok) return refusalMessage(res, "Failed to remove a lesson");
    }

    for (const lessonId of plan.materialDrops) {
      const res = await fetch(`/api/lessons/${lessonId}/material`, { method: "DELETE" });
      if (!res.ok) return refusalMessage(res, "Failed to remove the material");
    }

    for (const update of plan.updates) {
      const res = await fetch(`/api/lessons/${update.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: update.name,
          description: update.description,
          content_type: update.content_type,
          sequence_order: update.sequence_order,
        }),
      });
      if (!res.ok) return refusalMessage(res, "Failed to save a lesson");
    }

    for (const create of plan.creates) {
      const res = await fetch(`/api/modules/${mod.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: create.name,
          description: create.description ?? undefined,
          content_type: create.content_type,
          content_url: create.content_url ?? undefined,
          sequence_order: create.sequence_order,
        }),
      });
      if (!res.ok) return refusalMessage(res, "Failed to add a lesson");

      if (create.pendingFile) {
        const lesson = await res.json();
        // The row exists by now, so a failed upload leaves a lesson with no
        // material rather than losing the lesson: say which, and stop.
        const failure = await uploadMaterial(lesson.id, mod.id, create.content_type, create.pendingFile);
        if (failure) {
          await reloadModules();
          return `Lesson "${create.name}" was saved, but its file did not upload: ${failure}`;
        }
      }
    }

    for (const upload of plan.uploads) {
      const lesson = draft.lessons.find((l) => l.id === upload.lessonId);
      const failure = await uploadMaterial(upload.lessonId, mod.id, lesson?.content_type ?? "pdf", upload.file);
      if (failure) {
        await reloadModules();
        return failure;
      }
    }

    await reloadModules();
    return null;
  }

  return {
    courseName,
    courseDescription,
    error,
    submitting,
    modules,
    setCourseName,
    setCourseDescription,
    setModules,
    handleCreateCourse,
    handleAddModule,
    handleAddQaModule,
    handleDeleteModule,
    handleReorderModules,
    handleMoveLesson,
    handleSaveModule,
  };
}
