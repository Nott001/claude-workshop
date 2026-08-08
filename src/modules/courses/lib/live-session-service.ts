import type { DbClient } from "@/shared/db/dao/types";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as liveSessionDao from "@/modules/courses/db/live-session.dao";
import { CourseServiceError } from "@/modules/courses/lib/course-errors";

export type CourseActor = { id: number };

export type CourseHighlight = {
  highlighted_lesson_id: number | null;
  updated_by: number | null;
  updated_at: string | null;
  lesson: liveSessionDao.CourseHighlightLesson | null;
};

export async function getCourseHighlight(supabase: DbClient, courseId: number): Promise<CourseHighlight> {
  const course = await courseDao.findCourseById(supabase, courseId);
  if (!course) {
    throw new CourseServiceError(404, "Course not found");
  }

  const state = await liveSessionDao.findStateWithLesson(supabase, courseId);

  if (!state) {
    return { highlighted_lesson_id: null, updated_by: null, updated_at: null, lesson: null };
  }

  return {
    highlighted_lesson_id: state.highlighted_lesson_id,
    updated_by: state.updated_by,
    updated_at: state.updated_at,
    lesson: state.LESSON ?? null,
  };
}

export async function setCourseHighlight(
  supabase: DbClient,
  courseId: number,
  lessonId: number | null,
  actor: CourseActor,
): Promise<unknown> {
  const course = await courseDao.findCourseById(supabase, courseId);
  if (!course) {
    throw new CourseServiceError(404, "Course not found");
  }

  if (lessonId !== null) {
    const lesson = await courseDao.findLessonById(supabase, lessonId);

    if (!lesson) {
      throw new CourseServiceError(404, "Lesson not found");
    }

    const mod = await courseDao.findModuleById(supabase, lesson.module_id);

    if (!mod || mod.course_id !== courseId) {
      throw new CourseServiceError(400, "Lesson does not belong to this course");
    }
  }

  const { data, error } = await liveSessionDao.setHighlight(supabase, courseId, lessonId, actor.id);

  if (error || !data) {
    throw new CourseServiceError(500, "Failed to update highlight");
  }

  return data;
}

export async function clearCourseHighlight(
  supabase: DbClient,
  courseId: number,
  actor: CourseActor,
): Promise<{ highlighted_lesson_id: null }> {
  const { data, error } = await liveSessionDao.setHighlight(supabase, courseId, null, actor.id);

  if (error || !data) {
    throw new CourseServiceError(500, "Failed to update highlight");
  }

  return { highlighted_lesson_id: null };
}
