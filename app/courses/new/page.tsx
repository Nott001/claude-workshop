"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string;
  total_units: number;
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
  const [lessonContentType, setLessonContentType] = useState<string>("pdf");
  const [lessonContentUrl, setLessonContentUrl] = useState("");

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
    setLessonContentType("pdf");
    setLessonContentUrl("");
    setLessonDialogOpen(true);
  }

  async function handleAddLesson() {
    if (!activeModuleId) return;

    const mod = modules.find((m) => m.module_id === activeModuleId);
    if (!mod) return;

    const sequenceOrder = mod.LESSONS.length + 1;
    const res = await fetch(`/api/modules/${activeModuleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: lessonDescription,
        content_type: lessonContentType,
        content_url: lessonContentUrl || undefined,
        total_units: 1,
        sequence_order: sequenceOrder,
      }),
    });

    if (!res.ok) return;
    const lesson = await res.json();
    setModules((prev) => prev.map((m) => (m.module_id === activeModuleId ? { ...m, LESSONS: [...m.LESSONS, lesson] } : m)));
    setLessonDialogOpen(false);
    setActiveModuleId(null);
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

          {modules.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-[#D1D5DB] py-12 text-center">
              <span className="material-symbols-rounded mb-2 block text-[32px] text-[#D1D5DB]">post_add</span>
              <p className="text-sm text-[#6B7280]">No modules yet. Add your first module to start building the curriculum.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((mod) => (
                <div key={mod.module_id} className="rounded-lg border border-[#F3F4F6] bg-[#FAFBFC] p-5">
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
                        className="rounded-lg border border-[#29B6F6] bg-white px-3 py-1.5 text-sm font-semibold text-[#374151] outline-none ring-2 ring-[#29B6F6]/20"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[#334155]">{mod.module_name}</span>
                    )}

                    <button
                      onClick={() => {
                        setRenamingModuleId(mod.module_id);
                        setRenameValue(mod.module_name);
                      }}
                      className="rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#334155]"
                      title="Rename module"
                    >
                      <span className="material-symbols-rounded text-[14px]">edit</span>
                    </button>

                    <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">
                      {mod.LESSONS.length} {mod.LESSONS.length === 1 ? "lesson" : "lessons"}
                    </span>

                    <button
                      onClick={() => handleDeleteModule(mod.module_id)}
                      className="ml-auto rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
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
                          className="flex items-center justify-between rounded-lg border border-[#F3F4F6] bg-white px-4 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium text-[#9CA3AF]">
                              {mod.sequence_order}.{lesson.sequence_order}
                            </span>
                            <span className="text-sm text-[#374151]">{lesson.description}</span>
                            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                              {lesson.content_type}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteLesson(lesson.lesson_id, mod.module_id)}
                            className="rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
                            title="Delete lesson"
                          >
                            <span className="material-symbols-rounded text-[14px]">delete</span>
                          </button>
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
              <FormLabel>Content type</FormLabel>
              <select
                value={lessonContentType}
                onChange={(e) => setLessonContentType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="link">Link</option>
              </select>
            </FormField>

            <FormField className="mt-3">
              <FormLabel>Content URL (optional)</FormLabel>
              <Input value={lessonContentUrl} onChange={(e) => setLessonContentUrl(e.target.value)} placeholder="https://..." />
            </FormField>

            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={!lessonDescription.trim()}>
                <span className="material-symbols-rounded text-[16px]">add_circle</span>
                Add lesson
              </Button>
              <Button type="button" variant="outline" onClick={() => setLessonDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
