"use client";

import { useEffect, useState } from "react";
import { Footer } from "@/shared/components/footer";
import { useSession } from "@/modules/auth/components/session-context";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

interface CourseRow {
  id: number;
  course_name: string;
  course_description: string | null;
  event_title: string | null;
  event_date: string | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

export default function StaffCoursesPage() {
  const { isLoaded, user } = useSession();
  const role = user?.role ?? null;
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!hasMinRole(role, "admin")) return;
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load courses");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setCourses(data);
          setDataLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setDataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, role]);

  if (!hasMinRole(role, "admin")) return null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[1024px]">
          <div className="mb-8 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-info/10 p-2">
                <span className="material-symbols-rounded text-[24px] text-brand">menu_book</span>
              </div>
              <div>
                <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Courses</h1>
                <p className="mt-1 text-sm text-muted-fg">Audit view — all courses across events.</p>
              </div>
            </div>
          </div>

          {dataLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm text-muted-fg">Loading courses...</div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!dataLoading && !error && (
            <div className="rounded-xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 border-b border-border px-8 pb-4 pt-6">
                <span className="rounded-lg bg-info/10 p-2">
                  <span className="material-symbols-rounded text-[16px] text-brand">school</span>
                </span>
                <span className="text-xs font-bold tracking-[0.1em] text-fg">ALL COURSES ({courses.length})</span>
              </div>
              {courses.length === 0 ? (
                <div className="px-8 py-12 text-center text-sm text-muted-fg">No courses found.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-bold tracking-[0.1em] text-muted-fg">
                      <th className="px-8 py-3">Course Name</th>
                      <th className="px-8 py-3">Linked Event</th>
                      <th className="px-8 py-3">Event Date</th>
                      <th className="px-8 py-3">Created By</th>
                      <th className="px-8 py-3">Created</th>
                      <th className="px-8 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted">
                        <td className="px-8 py-4">
                          <span className="text-sm font-semibold text-fg">{course.course_name}</span>
                          {course.course_description && (
                            <p className="mt-0.5 text-xs text-muted-fg line-clamp-1">{course.course_description}</p>
                          )}
                        </td>
                        <td className="px-8 py-4 text-sm text-fg">
                          {course.event_title ?? <span className="text-muted-fg">&mdash;</span>}
                        </td>
                        <td className="px-8 py-4 text-sm text-muted-fg">
                          {course.event_date ?? <span className="text-muted-fg">&mdash;</span>}
                        </td>
                        <td className="px-8 py-4 text-sm text-fg">
                          {course.creator_name ?? <span className="text-muted-fg">&mdash;</span>}
                        </td>
                        <td className="px-8 py-4 text-sm text-muted-fg">{formatDate(course.created_at)}</td>
                        <td className="px-8 py-4 text-sm text-muted-fg">{formatDate(course.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer role={role} />
    </>
  );
}
