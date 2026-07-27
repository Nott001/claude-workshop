"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Course } from "@/types";
import { Footer } from "@/components/footer";

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
    load();
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

  async function handleDelete(id: number) {
    if (!confirm("Delete this course? This will remove all modules and lessons.")) return;
    const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    await fetchCourses();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg p-8">
        <div className="text-sm text-muted-foreground">Loading courses...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push("/events")}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Events
          </button>

          <div className="mb-8 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[24px] text-brand">menu_book</span>
              </div>
              <div>
                <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Courses</h1>
                <p className="mt-1 text-sm text-muted-fg">Manage your course offerings and curriculum.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/courses/new")}>
                <span className="material-symbols-rounded text-sm">add_circle</span>
                New Course
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {courses.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-surface py-16 text-center">
              <span className="material-symbols-rounded mb-3 block text-[40px] text-muted-fg">menu_book</span>
              <p className="text-sm text-muted-fg">No courses yet. Create your first course to get started.</p>
              <Button className="mt-4" onClick={() => router.push("/courses/new")}>
                <span className="material-symbols-rounded text-sm">add_circle</span>
                Create Course
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 border-b border-border px-8 pb-4 pt-6">
                <div className="rounded-lg bg-info/10 p-2">
                  <span className="material-symbols-rounded text-[16px] text-brand">school</span>
                </div>
                <span className="text-xs font-bold tracking-[0.1em] text-fg">ALL COURSES ({courses.length})</span>
              </div>
              <div className="divide-y divide-border">
                {courses.map((course) => (
                  <div
                    key={course.course_id}
                    className="group flex items-center justify-between px-8 py-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => router.push(`/courses/${course.course_id}`)}>
                      <h3 className="text-sm font-semibold text-fg group-hover:text-brand">{course.course_name}</h3>
                      {course.course_description && (
                        <p className="mt-0.5 text-sm text-muted-fg line-clamp-1">{course.course_description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/courses/${course.course_id}`)}
                        className="rounded-md p-1.5 text-muted-fg hover:bg-muted hover:text-fg"
                        title="Edit"
                      >
                        <span className="material-symbols-rounded text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(course.course_id)}
                        className="rounded-md p-1.5 text-muted-fg hover:bg-error/10 hover:text-error"
                        title="Delete"
                      >
                        <span className="material-symbols-rounded text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer role="facilitator" />
    </>
  );
}
