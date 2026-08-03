"use client";

import { useEffect, useState } from "react";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { Course } from "@/shared/types";

export interface CourseWithContent extends Course {
  MODULE: ModuleWithLessons[];
}

export function useCourseByEvent(eventId: string) {
  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/courses/event/${eventId}`);
      // `loading` has to be cancelled with the rest: clearing it from a run whose
      // result is discarded shows the "no course" state until the live run lands.
      if (cancelled) return;

      if (!res.ok) {
        setError("Failed to load course");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (cancelled) return;

      setCourse(data?.id ? data : null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { course, loading, error };
}
