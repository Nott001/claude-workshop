"use client";

import { useRouter } from "next/navigation";

interface Course {
  id: number;
  course_name: string;
  course_description: string | null;
}

export function CurriculumSection({ course, variant = "attendee" }: { course: Course; variant?: "facilitator" | "attendee" }) {
  const router = useRouter();

  const shared = (
    <>
      <h3 className="mb-2 text-[24px] font-bold text-fg">{course.course_name}</h3>
      {course.course_description && <p className="mb-4 text-base leading-[26px] text-muted-fg">{course.course_description}</p>}
      <button
        onClick={() => router.push(`/courses/${course.id}`)}
        className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
      >
        <span className="material-symbols-rounded text-sm">open_in_new</span>
        View Curriculum
      </button>
    </>
  );

  if (variant === "facilitator") {
    return (
      <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
            <span className="material-symbols-rounded text-lg text-brand">school</span>
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-fg">Linked Curriculum</h2>
          </div>
        </div>
        {shared}
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-[rgba(189,200,208,0.2)] bg-muted p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
          <span className="material-symbols-rounded text-lg text-brand">school</span>
        </div>
        <div>
          <h2 className="text-[20px] font-semibold text-fg">Linked Curriculum</h2>
        </div>
      </div>
      {shared}
    </div>
  );
}
