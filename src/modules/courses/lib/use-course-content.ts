"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import type { CourseGrant } from "@/modules/courses/lib/course-entitlement";
import type { CourseRoomCourse } from "@/modules/courses/lib/fetch-course-room-access";

export type ContentAccess = "loading" | "allowed" | "locked" | "missing";

interface CourseContentResponse {
  course: CourseRoomCourse | null;
  grant: CourseGrant;
  released_module_ids: number[];
}

/**
 * The self-paced course view's data.
 *
 * SWR rather than the room's bespoke effect: nothing here changes while it is
 * being read, so the view needs one cached fetch and no polling — the room's
 * five-second highlight refresh exists for a session this surface does not
 * have.
 */
export function useCourseContent(courseId: string) {
  const { data, error, isLoading } = useSWR<CourseContentResponse>(
    courseId ? `/api/courses/${courseId}/content` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const access: ContentAccess = isLoading ? "loading" : error ? "locked" : data?.course ? "allowed" : "missing";

  return {
    access,
    course: data?.course ?? null,
    grant: data?.grant ?? null,
    releasedModuleIds: data?.released_module_ids ?? [],
  };
}
