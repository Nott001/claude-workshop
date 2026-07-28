"use client";

import { useEffect, useState } from "react";
import type { Course } from "@/shared/types";

export function useCourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/courses");
      if (!res.ok) {
        if (!cancelled) setError("Failed to load courses");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) setCourses(data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshCourses() {
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
    await refreshCourses();
  }

  return { courses, loading, error, handleDelete };
}
