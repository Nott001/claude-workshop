"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { CourseCard } from "@/components/course-card";
import type { Course } from "@/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/courses");
    if (!res.ok) {
      setError("Failed to load courses");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCourses(data);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: formName,
        course_description: formDescription || null,
      }),
    });
    if (!res.ok) return;
    setCreateOpen(false);
    setFormName("");
    setFormDescription("");
    await fetchCourses();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editCourse) return;
    const res = await fetch(`/api/courses/${editCourse.course_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_name: formName,
        course_description: formDescription || null,
      }),
    });
    if (!res.ok) return;
    setEditCourse(null);
    setFormName("");
    setFormDescription("");
    await fetchCourses();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this course? This will remove all modules and lessons.")) return;
    const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    await fetchCourses();
  }

  function openEdit(course: Course) {
    setEditCourse(course);
    setFormName(course.course_name);
    setFormDescription(course.course_description ?? "");
  }

  function openCreate() {
    setEditCourse(null);
    setFormName("");
    setFormDescription("");
    setCreateOpen(true);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading courses...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-base font-bold text-foreground">Courses</span>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span className="material-symbols-rounded text-sm">add_circle</span>
                Create course
              </button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <Form onSubmit={handleCreate}>
              <FormField>
                <FormLabel>Name</FormLabel>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </FormField>
              <FormField>
                <FormLabel>Description</FormLabel>
                <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </FormField>
              <Button type="submit" className="mt-4">
                Save
              </Button>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {courses.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-sm text-muted-foreground">No courses yet. Create your first course.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <div key={course.course_id} className="group relative">
              <CourseCard courseId={course.course_id} title={course.course_name} moduleCount={0} />
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    openEdit(course);
                  }}
                  className="rounded bg-surface p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  title="Edit"
                >
                  <span className="material-symbols-rounded text-sm">edit</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(course.course_id);
                  }}
                  className="rounded bg-surface p-1.5 text-muted-foreground hover:bg-red-900/20 hover:text-red-500"
                  title="Delete"
                >
                  <span className="material-symbols-rounded text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!editCourse}
        onOpenChange={(open) => {
          if (!open) setEditCourse(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          <Form onSubmit={handleUpdate}>
            <FormField>
              <FormLabel>Name</FormLabel>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </FormField>
            <FormField>
              <FormLabel>Description</FormLabel>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </FormField>
            <Button type="submit" className="mt-4">
              Update
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
