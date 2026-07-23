"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import CourseBuilder from "@/components/course-builder";

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

  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonContentUrl, setLessonContentUrl] = useState("");
  const [lessonContentFile, setLessonContentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
    setActiveModuleId(moduleId);
    setLessonDescription("");
    setLessonContentUrl("");
    setLessonContentFile(null);
    setLessonDialogOpen(true);
  }

  function detectContentType(): string {
    if (lessonContentFile) {
      if (lessonContentFile.type === "application/pdf") return "pdf";
      if (lessonContentFile.type.startsWith("video/")) return "video";
      if (lessonContentFile.type.startsWith("image/")) return "image";
    }
    if (lessonContentUrl) {
      const url = normalizeUrl(lessonContentUrl);
      const ext = url.split(".").pop()?.toLowerCase() || "";
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

  async function handleAddLesson() {
    if (!activeModuleId) return;

    const mod = course?.MODULES.find((m) => m.module_id === activeModuleId);
    if (!mod) return;

    const sequenceOrder = mod.LESSONS.length + 1;
    setError(null);

    const contentType = detectContentType();

    const res = await fetch(`/api/modules/${activeModuleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: lessonDescription,
        content_type: contentType,
        content_url: lessonContentFile ? undefined : lessonContentUrl ? normalizeUrl(lessonContentUrl) : undefined,
        sequence_order: sequenceOrder,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? "Failed to create lesson");
      return;
    }
    const lesson = await res.json();

    if (lessonContentFile) {
      setUploading(true);
      const endpoint = getUploadEndpoint(contentType);
      if (endpoint) {
        const formData = new FormData();
        formData.append("file", lessonContentFile);
        formData.append("lesson_id", String(lesson.lesson_id));
        formData.append("course_id", courseId);
        formData.append("module_id", String(activeModuleId));

        const uploadRes = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => null);
          setError(uploadData?.error ?? "Lesson saved but file upload failed.");
          setUploading(false);
          await reloadCourse();
          return;
        }
        setUploading(false);
      }
    }

    setLessonDialogOpen(false);
    setActiveModuleId(null);
    setLessonContentFile(null);
    await reloadCourse();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#FBF9F8] p-8">
        <div className="text-sm text-muted-foreground">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#FBF9F8] p-8">
        <p className="text-destructive">{error ?? "Course not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/courses")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#FBF9F8] px-5 py-12 sm:px-8 md:px-12">
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
              <div className="rounded-lg bg-blue-50 p-2">
                <span className="material-symbols-rounded text-[24px] text-[#29B6F6]">menu_book</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#0F172A]">
                    {course.course_name}
                  </h1>
                  <button
                    onClick={openEditDialog}
                    className="rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#334155]"
                    title="Edit course"
                  >
                    <span className="material-symbols-rounded text-[18px]">edit</span>
                  </button>
                </div>
                {course.course_description && <p className="mt-1 text-sm text-[#6B7280]">{course.course_description}</p>}
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
          <div className="mb-8 rounded-xl border border-[#F3F4F6] bg-white p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center gap-3 border-b border-[#F9FAFB] pb-4">
              <div className="rounded-lg bg-blue-50 p-2">
                <span className="material-symbols-rounded text-[20px] text-[#29B6F6]">event</span>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">LINKED EVENTS</span>
            </div>
            <div className="space-y-2">
              {course.EVENTS.map((evt) => (
                <button
                  key={evt.event_id}
                  onClick={() => router.push(`/events/${evt.event_id}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-[#F3F4F6] bg-[#FAFBFC] px-5 py-3 text-left transition-colors hover:bg-[#F3F4F6]"
                >
                  <div>
                    <span className="text-sm font-semibold text-[#334155]">{evt.title}</span>
                    <span className="ml-3 text-xs text-[#6B7280]">
                      {new Date(evt.event_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#2563EB]">
                      {evt.status}
                    </span>
                  </div>
                  <span className="material-symbols-rounded text-[16px] text-[#9CA3AF]">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#F3F4F6] bg-white p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 border-b border-[#F9FAFB] pb-4">
            <div className="rounded-lg bg-blue-50 p-2">
              <span className="material-symbols-rounded text-[20px] text-[#29B6F6]">school</span>
            </div>
            <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">CURRICULUM</span>
          </div>

          <div className="mb-6 mt-6 flex items-center justify-between">
            <p className="text-sm text-[#6B7280]">Organize your course into modules and lessons.</p>
            <Button variant="outline" size="sm" onClick={handleAddModule}>
              <span className="material-symbols-rounded text-[14px]">add_circle</span>
              Add module
            </Button>
          </div>

          <CourseBuilder
            modules={course.MODULES}
            onModulesChange={(modules) => setCourse({ ...course, MODULES: modules })}
            onAddModule={handleAddModule}
            onAddLesson={openLessonDialog}
            onDeleteLesson={handleDeleteLesson}
            renamingModuleId={renamingModuleId}
            setRenamingModuleId={setRenamingModuleId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            renameInputRef={renameInputRef}
            onRenameModule={handleRenameModule}
            onDeleteModule={handleDeleteModule}
          />
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

        <Dialog
          open={lessonDialogOpen}
          onOpenChange={(open) => {
            setLessonDialogOpen(open);
            if (!open) setActiveModuleId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add lesson</DialogTitle>
            </DialogHeader>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddLesson();
              }}
            >
              <FormField>
                <FormLabel>Lesson name</FormLabel>
                <Input
                  value={lessonDescription}
                  onChange={(e) => setLessonDescription(e.target.value)}
                  placeholder="e.g. Introduction to the topic"
                  required
                />
              </FormField>

              <FormField className="mt-3">
                <FormLabel>Upload file</FormLabel>
                <input
                  type="file"
                  accept="application/pdf,video/mp4,video/webm,video/quicktime,image/jpeg,image/png"
                  onChange={(e) => {
                    setLessonContentFile(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0]) setLessonContentUrl("");
                  }}
                  className="block w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#2563EB] hover:file:bg-blue-100"
                />
                {lessonContentFile && <p className="mt-1 text-xs text-[#6B7280]">Selected: {lessonContentFile.name}</p>}
              </FormField>

              <FormField className="mt-3">
                <FormLabel>Or paste a URL</FormLabel>
                <Input
                  value={lessonContentUrl}
                  onChange={(e) => {
                    setLessonContentUrl(e.target.value);
                    if (e.target.value) setLessonContentFile(null);
                  }}
                  placeholder="https://..."
                />
              </FormField>

              <div className="mt-4 flex gap-2">
                <Button
                  type="submit"
                  disabled={!lessonDescription.trim() || uploading || (!lessonContentFile && !lessonContentUrl.trim())}
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <span className="material-symbols-rounded text-[16px]">add_circle</span>
                      Add lesson
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setLessonDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
