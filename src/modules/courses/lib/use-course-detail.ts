"use client";

import { useEffect, useState } from "react";
import { detectContentType, normalizeUrl, getUploadEndpoint } from "@/modules/courses/lib/lesson-utils";

export interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

export interface Module {
  module_id: number;
  course_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface LinkedEvent {
  event_id: number;
  title: string;
  event_date: string;
  status: string;
}

interface CourseDetail {
  course_id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
  EVENTS: LinkedEvent[];
}

export function useCourseDetail(courseId: string) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [lessonDialogModuleId, setLessonDialogModuleId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}`);
      if (!res.ok) {
        setError("Course not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCourse(data);
      setLoading(false);
    }
    load();
  }, [courseId]);

  async function reloadCourse() {
    const res = await fetch(`/api/courses/${courseId}`);
    if (!res.ok) return;
    const data = await res.json();
    setCourse(data);
  }

  async function handleEditCourse(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: editName,
        course_description: editDescription || null,
      }),
    });
    if (!res.ok) return;
    setEditDialogOpen(false);
    await reloadCourse();
  }

  function openEditDialog() {
    if (!course) return;
    setEditName(course.course_name);
    setEditDescription(course.course_description ?? "");
    setEditDialogOpen(true);
  }

  async function handleAddModule(): Promise<number | undefined> {
    const order = (course?.MODULES.length ?? 0) + 1;
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: `Module ${order}`, sequence_order: order }),
    });
    if (!res.ok) return;
    await reloadCourse();
    return undefined;
  }

  async function handleRenameModule(moduleId: number, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const mod = course?.MODULES.find((m) => m.module_id === moduleId);
    if (!mod || trimmed === mod.module_name) return;

    const res = await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: trimmed, sequence_order: mod.sequence_order }),
    });

    if (res.ok) {
      await reloadCourse();
    }
  }

  async function handleDeleteModule(moduleId: number) {
    if (!confirm("Delete this module and all its lessons?")) return;
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) return;
    await reloadCourse();
  }

  async function handleDeleteLesson(lessonId: number) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) return;
    await reloadCourse();
  }

  function openLessonDialog(moduleId: number) {
    setLessonDialogModuleId(moduleId);
  }

  async function handleAddLesson(data: { description: string; file: File | null; url: string }): Promise<string | null> {
    const moduleId = lessonDialogModuleId;
    if (!moduleId) return "No module selected";

    const mod = course?.MODULES.find((m) => m.module_id === moduleId);
    if (!mod) return "Module not found";

    const sequenceOrder = mod.LESSONS.length + 1;
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
        formData.append("course_id", courseId);
        formData.append("module_id", String(moduleId));

        const uploadRes = await fetch(endpoint, { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => null);
          await reloadCourse();
          return uploadData?.error ?? "Lesson saved but file upload failed.";
        }
      }
    }

    setLessonDialogModuleId(null);
    await reloadCourse();
    return null;
  }

  async function handleReorderModules(reordered: Module[]) {
    if (!course) return;
    setCourse({ ...course, MODULES: reordered });
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

  async function handleReorderLessons(moduleId: number, lessons: Lesson[]) {
    if (!course) return;
    setCourse({
      ...course,
      MODULES: course.MODULES.map((m) => (m.module_id === moduleId ? { ...m, LESSONS: lessons } : m)),
    });
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
    course,
    loading,
    error,
    editDialogOpen,
    editName,
    editDescription,
    lessonDialogModuleId,
    setEditDialogOpen,
    setEditName,
    setEditDescription,
    openEditDialog,
    handleEditCourse,
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
