import type { DbClient } from "@/shared/db/dao/types";
import * as eventDao from "@/modules/events/db/event.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as liveSessionDao from "@/modules/events/db/live-session.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";
import type { EventActor } from "@/modules/events/lib/event-authz";

export async function getEventHighlight(
  supabase: DbClient,
  id: number,
): Promise<{
  highlighted_lesson_id: number | null;
  updated_by: number | null;
  updated_at: string | null;
  lesson: unknown;
}> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  const state = await liveSessionDao.getHighlightState(supabase, id);

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

export async function setEventHighlight(
  supabase: DbClient,
  id: number,
  lessonId: number | null,
  actor: EventActor,
): Promise<unknown> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (lessonId !== null) {
    const lesson = await courseDao.findLessonById(supabase, lessonId);

    if (!lesson) {
      throw new EventServiceError(404, "Lesson not found");
    }

    const mod = await courseDao.findModuleById(supabase, lesson.module_id);

    const courseId = await courseDao.findIdByEventId(supabase, id);

    if (!mod || !courseId || mod.course_id !== courseId) {
      throw new EventServiceError(400, "Lesson does not belong to this event's course");
    }
  }

  const state = await liveSessionDao.upsertHighlightState(supabase, id, {
    highlighted_lesson_id: lessonId,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  });

  if (!state) {
    throw new EventServiceError(500, "Failed to update highlight");
  }

  return state;
}

export async function clearEventHighlight(
  supabase: DbClient,
  id: number,
  actor: EventActor,
): Promise<{ highlighted_lesson_id: null }> {
  const state = await liveSessionDao.upsertHighlightState(supabase, id, {
    highlighted_lesson_id: null,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  });

  if (!state) {
    throw new EventServiceError(500, "Failed to update highlight");
  }

  return { highlighted_lesson_id: null };
}
