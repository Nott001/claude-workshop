"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import type { Course } from "@/types";

export default function CoursesPage() {
  const router = useRouter();
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
      body: JSON.stringify({ course_name: formName, course_description: formDescription || null }),
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
      body: JSON.stringify({ course_name: formName, course_description: formDescription || null }),
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
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-foreground text-3xl font-bold">Courses</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button onClick={openCreate}>Create Course</Button>} />
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

      {error && <p className="text-destructive mb-4">{error}</p>}

      {courses.length === 0 ? (
        <p className="text-muted-foreground">No courses yet. Create your first course.</p>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <Card key={course.course_id}>
              <CardHeader>
                <CardTitle>{course.course_name}</CardTitle>
                {course.course_description && <CardDescription>{course.course_description}</CardDescription>}
              </CardHeader>
              <CardFooter className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/courses/${course.course_id}`)}>
                  View Modules
                </Button>
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" onClick={() => openEdit(course)}>Edit</Button>} />
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
                <Button variant="destructive" onClick={() => handleDelete(course.course_id)}>
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
