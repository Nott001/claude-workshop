"use client";

import { useRouter, useParams } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { useCourseDetail } from "@/modules/courses/lib/use-course-detail";

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const { course, loading, error } = useCourseDetail(courseId);

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
        <Button variant="secondary" className="mt-4" onClick={() => router.push("/courses")}>
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
          <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-fg">{course.course_name}</h1>
          {course.course_description && <p className="mt-2 text-sm text-muted-fg">{course.course_description}</p>}
        </div>

        {course.MODULES && course.MODULES.length > 0 ? (
          <div className="space-y-4">
            {course.MODULES.map((mod) => (
              <div key={mod.module_id} className="rounded-xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-fg">{mod.module_name}</h3>
                {mod.LESSONS && mod.LESSONS.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {mod.LESSONS.map((lesson) => (
                      <div
                        key={lesson.lesson_id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-fg"
                      >
                        <span className="material-symbols-rounded text-[14px]">description</span>
                        {lesson.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-fg">No modules yet.</p>
        )}
      </div>
    </div>
  );
}
