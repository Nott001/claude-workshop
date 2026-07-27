"use client";

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
}

interface CourseSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  courses: Course[];
  error: string | null;
  onNoCoursesAction?: () => void;
}

export function CourseSelect({ value, onValueChange, courses, error, onNoCoursesAction }: CourseSelectProps) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-info">
        Connect this event to an existing curriculum for automatic resource sharing.
      </p>
      {error && <p className="mb-2 text-xs text-error">{error}</p>}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="mt-3 w-full rounded-lg border-border bg-surface px-4 py-3 text-base text-fg">
          <SelectValue placeholder="No curriculum linked">
            {(val: string) => {
              if (!val || val === "__none__") return "No curriculum linked";
              return courses.find((c) => String(c.course_id) === val)?.course_name ?? "No curriculum linked";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None — no curriculum</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.course_id} value={String(c.course_id)}>
              {c.course_name}
            </SelectItem>
          ))}
          {courses.length === 0 && !error && (
            <SelectItem value="__create__" disabled>
              No courses available — create one first
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {courses.length === 0 && !error && onNoCoursesAction && (
        <p className="mt-2 text-xs text-muted-fg">
          No courses available.{" "}
          <button
            type="button"
            onClick={onNoCoursesAction}
            className="font-medium text-info underline underline-offset-2 hover:text-info"
          >
            Create a course
          </button>
        </p>
      )}
    </div>
  );
}
