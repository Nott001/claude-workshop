"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import type { CourseSummary } from "@/shared/db/dao/course.dao";

/**
 * The courses whose after-event material the signed-in user can now read. The
 * route answers for the session, so there is nothing to pass and nothing to
 * key on but the path itself.
 */
export function useCourseLibrary() {
  const { data, error, isLoading } = useSWR<{ courses: CourseSummary[] }>("/api/courses/library", fetcher, {
    revalidateOnFocus: false,
  });

  return {
    courses: data?.courses ?? [],
    loading: isLoading,
    error: error ? "Could not load your courses." : null,
  };
}
