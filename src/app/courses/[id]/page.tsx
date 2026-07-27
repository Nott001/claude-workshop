"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { LessonDialog } from "@/modules/course-content/ui/lesson-dialog";
import { CurriculumBuilder } from "@/modules/course-content/ui/curriculum-builder";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface Module {
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

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
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

  function detectContentType(file: File | null, url: string): string {
    if (file) {
      if (file.type === "application/pdf") return "pdf";
      if (file.type.startsWith("video/")) return "video";
      if (file.type.startsWith("image/")) return "image";
    }
    if (url) {
      const normalized = normalizeUrl(url);
      const ext = normalized.split(".").pop()?.toLowerCase() || "";
      if (ext === "pdf") return "pdf";
      if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
      return "link";
    }
    return "pdf";
  }

  function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
  }

  function getUploadEndpoint(type: string): string | null {
    if (type === "video") return "/api/upload/course-video";
    if (type === "pdf" || type === "image") return "/api/upload/course-asset";
    return null;
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg p-8">
        <div className="text-sm text-muted-foreground">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg p-8">
        <p className="text-destructive">{error ?? "Course not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/courses")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto w-full max-w-[896px]">
        <button
          onClick={() => router.push("/courses")}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Courses
        </button>

        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[24px] text-brand">menu_book</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-fg">{course.course_name}</h1>
                  <button
                    onClick={openEditDialog}
                    className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
                    title="Edit course"
                  >
                    <span className="material-symbols-rounded text-[18px]">edit</span>
                  </button>
                </div>
                {course.course_description && <p className="mt-1 text-sm text-muted-fg">{course.course_description}</p>}
              </div>
            </div>
            <div className="flex gap-2"></div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {course.EVENTS && course.EVENTS.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[20px] text-brand">event</span>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-fg">LINKED EVENTS</span>
            </div>
            <div className="space-y-2">
              {course.EVENTS.map((evt) => (
                <button
                  key={evt.event_id}
                  onClick={() => router.push(`/events/${evt.event_id}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-muted px-5 py-3 text-left transition-colors hover:bg-muted"
                >
                  <div>
                    <span className="text-sm font-semibold text-fg">{evt.title}</span>
                    <span className="ml-3 text-xs text-muted-fg">
                      {new Date(evt.event_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-info">
                      {evt.status}
                    </span>
                  </div>
                  <span className="material-symbols-rounded text-[16px] text-muted-fg">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <CurriculumBuilder
          modules={course.MODULES}
          onAddModule={handleAddModule}
          onRenameModule={handleRenameModule}
          onDeleteModule={handleDeleteModule}
          onDeleteLesson={handleDeleteLesson}
          onAddLessonClick={openLessonDialog}
          onReorderModules={handleReorderModules}
          onReorderLessons={handleReorderLessons}
        />

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
            </DialogHeader>
            <Form onSubmit={handleEditCourse}>
              <FormField>
                <FormLabel>Name</FormLabel>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </FormField>
              <FormField>
                <FormLabel>Description</FormLabel>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </FormField>
              <Button type="submit" className="mt-4">
                Save
              </Button>
            </Form>
          </DialogContent>
        </Dialog>

        <LessonDialog
          open={lessonDialogModuleId !== null}
          onOpenChange={(open) => {
            if (!open) setLessonDialogModuleId(null);
          }}
          onAddLesson={handleAddLesson}
        />
      </div>
    </div>
  );
}
