"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { PlusIcon, ChevronRightIcon, FileTextIcon } from "lucide-react";

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

interface CourseDetail {
  course_id: number;
  course_name: string;
  course_description: string | null;
  MODULES: Module[];
}

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [moduleOrder, setModuleOrder] = useState("1");

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

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: moduleName, sequence_order: Number(moduleOrder) }),
    });
    if (!res.ok) return;
    setModuleDialogOpen(false);
    setModuleName("");
    setModuleOrder("1");
    await reloadCourse();
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

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">Loading course...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-destructive">{error ?? "Course not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/courses")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Button variant="ghost" className="mb-2" onClick={() => router.push("/courses")}>
          &larr; Back to Courses
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold">{course.course_name}</h1>
            {course.course_description && <p className="text-muted-foreground mt-1">{course.course_description}</p>}
          </div>
          <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <PlusIcon className="mr-1 size-4" /> Add Module
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Module</DialogTitle>
              </DialogHeader>
              <Form onSubmit={handleCreateModule}>
                <FormField>
                  <FormLabel>Module Name</FormLabel>
                  <Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} required />
                </FormField>
                <FormField>
                  <FormLabel>Sequence Order</FormLabel>
                  <Input type="number" value={moduleOrder} onChange={(e) => setModuleOrder(e.target.value)} min="1" required />
                </FormField>
                <Button type="submit" className="mt-4">
                  Save
                </Button>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {course.MODULES.length === 0 ? (
        <p className="text-muted-foreground">No modules yet. Add your first module.</p>
      ) : (
        <div className="space-y-4">
          {course.MODULES.map((mod) => (
            <Card key={mod.module_id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">#{mod.sequence_order}</span>
                    {mod.module_name}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/courses/${courseId}/modules/${mod.module_id}`)}
                  >
                    <FileTextIcon className="mr-1 size-4" /> Edit Lessons
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteModule(mod.module_id)}>
                    Delete
                  </Button>
                </div>
              </CardHeader>
              {mod.LESSONS.length > 0 && (
                <CardContent>
                  <div className="space-y-2">
                    {mod.LESSONS.map((lesson) => (
                      <div key={lesson.lesson_id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex items-center gap-2">
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                          <span>
                            #{lesson.sequence_order} {lesson.description}
                          </span>
                          <span className="text-muted-foreground rounded bg-muted px-1.5 py-0.5 text-xs">
                            {lesson.content_type}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/courses/${courseId}/lessons/${lesson.lesson_id}`)}
                          >
                            View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteLesson(lesson.lesson_id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
