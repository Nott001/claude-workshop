"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Footer } from "@/components/footer";
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

export default function NewCoursePage() {
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

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push("/courses")}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Courses
          </button>

          <div className="mb-12">
            <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Create New Course</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <Form onSubmit={handleCreateCourse} className="space-y-8">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-lg bg-info/10 p-2">
                  <span className="material-symbols-rounded text-[20px] text-brand">menu_book</span>
                </div>
                <span className="text-xs font-bold tracking-[0.1em] text-fg">COURSE DETAILS</span>
              </div>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Course Title</FormLabel>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Digital Strategy 101"
                  className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Description</FormLabel>
                <Textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="What will attendees learn in this course?"
                  className="min-h-[88px] rounded-lg border-border bg-muted px-4 py-3 text-base text-fg"
                />
              </FormField>

              <div className="flex items-center justify-end gap-6 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/courses")}
                  disabled={submitting}
                  className="text-sm font-semibold text-muted-fg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: "#29B6F6",
                    boxShadow: "0 4px 6px -4px rgba(191, 219, 254, 1), 0 10px 15px -3px rgba(191, 219, 254, 1)",
                  }}
                  className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-brand/90"
                >
                  {submitting ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </Form>
          </div>

          <div className="mt-8">
            <CurriculumBuilder
              modules={modules}
              onAddModule={handleAddModule}
              onRenameModule={handleRenameModule}
              onDeleteModule={handleDeleteModule}
              onDeleteLesson={handleDeleteLesson}
              onAddLessonClick={openLessonDialog}
              onReorderModules={handleReorderModules}
              onReorderLessons={handleReorderLessons}
            />
          </div>
        </div>

        <LessonDialog
          open={lessonDialogModuleId !== null}
          onOpenChange={(open) => {
            if (!open) setLessonDialogModuleId(null);
          }}
          onAddLesson={handleAddLesson}
        />
      </div>
      <Footer role="facilitator" />
    </>
  );
}
