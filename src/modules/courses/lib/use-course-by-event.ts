"use client";

import { useEffect, useState } from "react";

interface CourseLesson {
  id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface CourseModule {
  id: number;
  course_id: number;
  module_name: string;
  sequence_order: number;
  LESSON: CourseLesson[];
}

export interface CourseWithContent {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULE: CourseModule[];
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
      if (!res.ok) {
        if (!cancelled) setError("Failed to load course");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setCourse(data?.id ? data : null);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { course, loading, error };
}
