"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { detectContentType, normalizeUrl, getUploadEndpoint } from "@/modules/course-content/lib/lesson-utils";
import type { Lesson, Module } from "@/modules/course-content/lib/use-course-detail";

export function useCourseCreate() {
  const router = useRouter();

  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [modules, setModules] = useState<Module[]>([]);
  const [lessonDialogModuleId, setLessonDialogModuleId] = useState<number | null>(null);

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
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Failed to create course");
      setSubmitting(false);
      return;
    }

    const course = await res.json();
    router.push(`/courses/${course.course_id}`);
  }

  async function ensureCourseCreated(): Promise<number | null> {
    if (modules.length > 0) {
      return modules[0].course_id;
    }

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: courseName || "Untitled Course",
        course_description: courseDescription || null,
      }),
    });

    if (!res.ok) {
      setError("Failed to create course");
      return null;
    }

    const course = await res.json();
    setCourseName(course.course_name);
    return course.course_id;
  }

  async function handleAddModule(): Promise<number | undefined> {
    const courseId = await ensureCourseCreated();
    if (!courseId) return;

    const order = modules.length + 1;
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: `Module ${order}`, sequence_order: order }),
    });
    if (!res.ok) return;
    const mod = await res.json();
    setModules((prev) => [...prev, { ...mod, LESSONS: [] }]);
    return mod.module_id;
  }

  async function handleRenameModule(moduleId: number, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const mod = modules.find((m) => m.module_id === moduleId);
    if (!mod || trimmed === mod.module_name) return;

    const res = await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: trimmed, sequence_order: mod.sequence_order }),
    });

    if (res.ok) {
      setModules((prev) => prev.map((m) => (m.module_id === moduleId ? { ...m, module_name: trimmed } : m)));
    }
  }

  async function handleDeleteModule(moduleId: number) {
    if (!confirm("Delete this module and all its lessons?")) return;
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) return;
    setModules((prev) => prev.filter((m) => m.module_id !== moduleId));
  }

  async function handleDeleteLesson(lessonId: number, moduleId: number) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) return;
    setModules((prev) =>
      prev.map((m) => (m.module_id === moduleId ? { ...m, LESSONS: m.LESSONS.filter((l) => l.lesson_id !== lessonId) } : m)),
    );
  }

  function openLessonDialog(moduleId: number) {
    setLessonDialogModuleId(moduleId);
  }

  async function handleAddLesson(data: { description: string; file: File | null; url: string }): Promise<string | null> {
    const moduleId = lessonDialogModuleId;
    if (!moduleId) return "No module selected";

    const mod = modules.find((m) => m.module_id === moduleId);
    if (!mod) return "Module not found";

    const sequenceOrder = mod.LESSONS.length + 1;
    setError(null);

    const contentType = detectContentType(data.file, data.url);

    const res = await fetch(`/api/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: data.description,
        content_type: contentType,
        content_url: data.file ? undefined : data.url ? normalizeUrl(data.url) : undefined,
        sequence_order: sequenceOrder,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return err?.error?.message ?? "Failed to create lesson";
    }
    const lesson = await res.json();

    if (data.file) {
      const endpoint = getUploadEndpoint(contentType);
      if (endpoint) {
        const formData = new FormData();
        formData.append("file", data.file);
        formData.append("lesson_id", String(lesson.lesson_id));
        formData.append("course_id", String(modules[0].course_id));
        formData.append("module_id", String(moduleId));

        const uploadRes = await fetch(endpoint, { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => null);
          return uploadData?.error ?? "Lesson saved but file upload failed.";
        }
      }
    }

    setModules((prev) => prev.map((m) => (m.module_id === moduleId ? { ...m, LESSONS: [...m.LESSONS, lesson] } : m)));
    setLessonDialogModuleId(null);
    return null;
  }

  async function handleReorderModules(reordered: Module[]) {
    setModules(reordered);
    await Promise.all(
      reordered.map((m) =>
        fetch(`/api/modules/${m.module_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module_name: m.module_name, sequence_order: m.sequence_order }),
        }),
      ),
    );
  }

  async function handleReorderLessons(_moduleId: number, lessons: Lesson[]) {
    setModules((prev) => prev.map((m) => (m.module_id === _moduleId ? { ...m, LESSONS: lessons } : m)));
    await Promise.all(
      lessons.map((l) =>
        fetch(`/api/lessons/${l.lesson_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: l.description,
            content_type: l.content_type,
            content_url: l.content_url,
            sequence_order: l.sequence_order,
          }),
        }),
      ),
    );
  }

  return {
    courseName,
    courseDescription,
    error,
    submitting,
    modules,
    lessonDialogModuleId,
    setCourseName,
    setCourseDescription,
    setLessonDialogModuleId,
    handleCreateCourse,
    handleAddModule,
    handleRenameModule,
    handleDeleteModule,
    handleDeleteLesson,
    openLessonDialog,
    handleAddLesson,
    handleReorderModules,
    handleReorderLessons,
  };
}
