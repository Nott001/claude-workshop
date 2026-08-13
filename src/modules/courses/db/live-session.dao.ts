import type { DbClient } from "@/shared/db/dao/types";
import { throwOnDbError } from "@/shared/db/dao/helpers";
import type { ContentType } from "@/shared/types";

export type CourseHighlightLesson = {
  id: number;
  name: string;
  description: string | null;
  content_type: ContentType;
};

export type CourseHighlightStateRow = {
  highlighted_lesson_id: number | null;
  updated_by: number | null;
  updated_at: string | null;
  LESSON?: CourseHighlightLesson | null;
};

export async function findStateWithLesson(supabase: DbClient, courseId: number): Promise<CourseHighlightStateRow | null> {
  const { data, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("*, LESSON(id, name, description, content_type)")
    .eq("course_id", courseId)
    .maybeSingle();
  throwOnDbError(error, "live-session.dao.findStateWithLesson");
  return data;
}

export async function setHighlight(
  supabase: DbClient,
  courseId: number,
  lessonId: number | null,
  updatedBy: number,
): Promise<{ data: CourseHighlightStateRow | null; error: unknown }> {
  return supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      { course_id: courseId, highlighted_lesson_id: lessonId, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: "course_id" },
    )
    .select()
    .single();
}
