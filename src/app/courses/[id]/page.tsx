"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { LessonDialog } from "@/modules/course-content/ui/lesson-dialog";

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

  const [renamingModuleId, setRenamingModuleId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [lessonDialogModuleId, setLessonDialogModuleId] = useState<number | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<number | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<number | null>(null);

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

  useEffect(() => {
    if (renamingModuleId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingModuleId]);

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

  async function handleAddModule() {
    const order = (course?.MODULES.length ?? 0) + 1;
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: `Module ${order}`, sequence_order: order }),
    });
    if (!res.ok) return;
    await reloadCourse();
  }

  async function handleRenameModule(moduleId: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingModuleId(null);
      return;
    }

    const mod = course?.MODULES.find((m) => m.module_id === moduleId);
    if (!mod || trimmed === mod.module_name) {
      setRenamingModuleId(null);
      return;
    }

    const res = await fetch(`/api/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: trimmed, sequence_order: mod.sequence_order }),
    });

    if (res.ok) {
      await reloadCourse();
    }
    setRenamingModuleId(null);
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

  function handleModuleDragStart(e: React.DragEvent, moduleId: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(moduleId));
  }

  async function handleModuleDrop(e: React.DragEvent, targetModuleId: number) {
    e.preventDefault();
    setDragOverModuleId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetModuleId || !course) return;

    const modules = [...course.MODULES];
    const draggedIdx = modules.findIndex((m) => m.module_id === draggedId);
    const targetIdx = modules.findIndex((m) => m.module_id === targetModuleId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [moved] = modules.splice(draggedIdx, 1);
    modules.splice(targetIdx, 0, moved);
    const reordered = modules.map((m, i) => ({ ...m, sequence_order: i + 1 }));
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

  function handleLessonDragStart(e: React.DragEvent, lessonId: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(lessonId));
  }

  async function handleLessonDrop(e: React.DragEvent, targetLessonId: number, moduleId: number) {
    e.preventDefault();
    setDragOverLessonId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetLessonId || !course) return;

    const mod = course.MODULES.find((m) => m.module_id === moduleId);
    if (!mod) return;

    const lessons = [...mod.LESSONS];
    const draggedIdx = lessons.findIndex((l) => l.lesson_id === draggedId);
    const targetIdx = lessons.findIndex((l) => l.lesson_id === targetLessonId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [moved] = lessons.splice(draggedIdx, 1);
    lessons.splice(targetIdx, 0, moved);
    const reordered = lessons.map((l, i) => ({ ...l, sequence_order: i + 1 }));

    setCourse({
      ...course,
      MODULES: course.MODULES.map((m) => (m.module_id === moduleId ? { ...m, LESSONS: reordered } : m)),
    });

    await Promise.all(
      reordered.map((l) =>
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

        <div className="rounded-xl border border-border bg-surface p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="rounded-lg bg-info/10 p-2">
              <span className="material-symbols-rounded text-[20px] text-brand">school</span>
            </div>
            <span className="text-xs font-bold tracking-[0.1em] text-fg">CURRICULUM</span>
          </div>

          <div className="mb-6 mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-fg">Organize your course into modules and lessons.</p>
            <Button variant="outline" size="sm" onClick={handleAddModule}>
              <span className="material-symbols-rounded text-[14px]">add_circle</span>
              Add module
            </Button>
          </div>

          {course.MODULES.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
              <span className="material-symbols-rounded mb-2 block text-[32px] text-muted-fg">post_add</span>
              <p className="text-sm text-muted-fg">No modules yet. Add your first module to start building the curriculum.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {course.MODULES.map((mod) => (
                <div
                  key={mod.module_id}
                  draggable
                  onDragStart={(e) => handleModuleDragStart(e, mod.module_id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverModuleId(mod.module_id);
                  }}
                  onDragLeave={() => setDragOverModuleId(null)}
                  onDrop={(e) => handleModuleDrop(e, mod.module_id)}
                  onDragEnd={() => setDragOverModuleId(null)}
                  className={`rounded-lg border bg-muted p-5 transition-shadow ${
                    dragOverModuleId === mod.module_id
                      ? "border-brand shadow-[0_0_0_2px_rgba(41,182,246,0.2)]"
                      : "border-border"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    {renamingModuleId === mod.module_id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameModule(mod.module_id);
                          if (e.key === "Escape") setRenamingModuleId(null);
                        }}
                        onBlur={() => handleRenameModule(mod.module_id)}
                        className="rounded-lg border border-brand bg-surface px-3 py-1.5 text-sm font-semibold text-fg outline-none ring-2 ring-ring/20"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-fg">{mod.module_name}</span>
                    )}

                    <button
                      onClick={() => {
                        setRenamingModuleId(mod.module_id);
                        setRenameValue(mod.module_name);
                      }}
                      className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
                      title="Rename module"
                    >
                      <span className="material-symbols-rounded text-[14px]">edit</span>
                    </button>

                    <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
                      {mod.LESSONS.length} {mod.LESSONS.length === 1 ? "lesson" : "lessons"}
                    </span>

                    <button
                      onClick={() => handleDeleteModule(mod.module_id)}
                      className="ml-auto rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
                      title="Delete module"
                    >
                      <span className="material-symbols-rounded text-[14px]">delete</span>
                    </button>
                  </div>

                  {mod.LESSONS.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {mod.LESSONS.map((lesson) => (
                        <div
                          key={lesson.lesson_id}
                          draggable
                          onDragStart={(e) => handleLessonDragStart(e, lesson.lesson_id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverLessonId(lesson.lesson_id);
                          }}
                          onDragLeave={() => setDragOverLessonId(null)}
                          onDrop={(e) => handleLessonDrop(e, lesson.lesson_id, mod.module_id)}
                          onDragEnd={() => setDragOverLessonId(null)}
                          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 transition-shadow ${
                            dragOverLessonId === lesson.lesson_id
                              ? "border-brand bg-surface shadow-[0_0_0_2px_rgba(41,182,246,0.2)]"
                              : "border-border bg-surface"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium text-muted-fg">
                              {mod.sequence_order}.{lesson.sequence_order}
                            </span>
                            <span className="text-sm text-fg">{lesson.description}</span>
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                              {lesson.content_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {lesson.content_url && (
                              <Button variant="ghost" size="sm" onClick={() => window.open(lesson.content_url, "_blank")}>
                                View
                              </Button>
                            )}
                            <button
                              onClick={() => handleDeleteLesson(lesson.lesson_id)}
                              className="rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
                              title="Delete lesson"
                            >
                              <span className="material-symbols-rounded text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => openLessonDialog(mod.module_id)}>
                    <span className="material-symbols-rounded text-[14px]">add_circle</span>
                    Add lesson to topic
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

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
