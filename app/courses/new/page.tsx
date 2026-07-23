"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Footer } from "@/components/footer";
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

export default function NewCoursePage() {
  const router = useRouter();

  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [modules, setModules] = useState<Module[]>([]);
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
    if (renamingModuleId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingModuleId]);

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

  async function handleAddModule() {
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
    setRenamingModuleId(mod.module_id);
    setRenameValue(`Module ${order}`);
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

  async function handleRenameModule(moduleId: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingModuleId(null);
      return;
    }

    const mod = modules.find((m) => m.module_id === moduleId);
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
      setModules((prev) => prev.map((m) => (m.module_id === moduleId ? { ...m, module_name: trimmed } : m)));
    }
    setRenamingModuleId(null);
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

    const mod = modules.find((m) => m.module_id === activeModuleId);
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
        formData.append("course_id", String(modules[0].course_id));
        formData.append("module_id", String(activeModuleId));

        const uploadRes = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => null);
          setError(uploadData?.error ?? "Lesson saved but file upload failed.");
          setUploading(false);
          return;
        }
        setUploading(false);
      }
    }

    setModules((prev) => prev.map((m) => (m.module_id === activeModuleId ? { ...m, LESSONS: [...m.LESSONS, lesson] } : m)));
    setLessonDialogOpen(false);
    setActiveModuleId(null);
    setLessonContentFile(null);
  }

  return (
    <>
      <div className="flex flex-1 flex-col bg-[#FBF9F8] px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push("/courses")}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Courses
          </button>

          <div className="mb-12">
            <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-[#0F172A]">Create New Course</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-[#F3F4F6] bg-white p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <Form onSubmit={handleCreateCourse} className="space-y-8">
              <div className="flex items-center gap-3 border-b border-[#F9FAFB] pb-4">
                <div className="rounded-lg bg-blue-50 p-2">
                  <span className="material-symbols-rounded text-[20px] text-[#29B6F6]">menu_book</span>
                </div>
                <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">COURSE DETAILS</span>
              </div>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Course Title</FormLabel>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Digital Strategy 101"
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Description</FormLabel>
                <Textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="What will attendees learn in this course?"
                  className="min-h-[88px] rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]"
                />
              </FormField>

              <div className="flex items-center justify-end gap-6 border-t border-[#F9FAFB] pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/courses")}
                  disabled={submitting}
                  className="text-sm font-semibold text-[#6B7280]"
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
                  className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-[#239dce]"
                >
                  {submitting ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </Form>
          </div>

          <div className="mt-8 rounded-xl border border-[#F3F4F6] bg-white p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <div className="mb-8 flex items-center gap-3 border-b border-[#F9FAFB] pb-4">
              <div className="rounded-lg bg-blue-50 p-2">
                <span className="material-symbols-rounded text-[20px] text-[#29B6F6]">school</span>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">CURRICULUM BUILDER</span>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-[#6B7280]">Organize your course into modules and lessons.</p>
              <Button variant="outline" size="sm" onClick={handleAddModule}>
                <span className="material-symbols-rounded text-[14px]">add_circle</span>
                Add module
              </Button>
            </div>

            <CourseBuilder
              modules={modules}
              onModulesChange={setModules}
              onAddModule={handleAddModule}
              onAddLesson={openLessonDialog}
              onDeleteLesson={(lessonId, moduleId) => handleDeleteLesson(lessonId, moduleId)}
              renamingModuleId={renamingModuleId}
              setRenamingModuleId={setRenamingModuleId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              renameInputRef={renameInputRef}
              onRenameModule={handleRenameModule}
              onDeleteModule={handleDeleteModule}
            />
          </div>
        </div>

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
      <Footer role="facilitator" />
    </>
  );
}
