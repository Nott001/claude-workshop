import type { z } from "zod";
import type { DbClient } from "@/shared/db/dao/types";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { findTimeOverlaps } from "@/modules/courses/lib/scheduling";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export class CourseModuleServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function setModuleLock(
  supabase: DbClient,
  id: number,
  isLocked: boolean,
): Promise<NonNullable<Awaited<ReturnType<typeof courseDao.setModuleLock>>>> {
  const mod = await courseDao.setModuleLock(supabase, id, isLocked);
  if (!mod) {
    throw new CourseModuleServiceError(500, "Failed to update lock state");
  }
  return mod;
}

// A module may only be assigned a speaker who is assigned to the event the
// module's course teaches. `null` is the clear value and needs no check.
async function ensureSpeakerAssigned(supabase: DbClient, moduleId: number, speakerProfileId: number): Promise<void> {
  const course = await courseDao.findCourseByModule(supabase, moduleId);
  const assigned = course !== null && (await speakerDao.checkSpeakerAssignment(supabase, speakerProfileId, course.event_id));
  if (!assigned) {
    throw new CourseModuleServiceError(400, "Speaker is not assigned to this event");
  }
}

// An edit may not make the module collide with another session. A pre-existing
// overlap between two untouched modules is surfaced elsewhere, not a reason to
// refuse an unrelated edit, so only a conflict involving the edited module is
// rejected.
async function mergeConflictingTimes(
  supabase: DbClient,
  moduleId: number,
  input: Pick<z.infer<typeof moduleSchema>, "start_time" | "end_time">,
): Promise<void> {
  if (input.start_time === undefined && input.end_time === undefined) return;

  const current = await courseDao.findModuleById(supabase, moduleId);
  if (!current) {
    throw new CourseModuleServiceError(500, "Failed to load module");
  }
  const merged = {
    start_time: input.start_time ?? current.start_time,
    end_time: input.end_time ?? current.end_time,
  };
  const siblings = await courseDao.findModulesByCourse(supabase, current.course_id);
  const proposed = siblings.map((m) => (m.id === moduleId ? { ...m, ...merged } : m));
  const conflict = findTimeOverlaps(proposed).find(([a, b]) => a.id === moduleId || b.id === moduleId);
  if (conflict) {
    const other = conflict[0].id === moduleId ? conflict[1] : conflict[0];
    throw new CourseModuleServiceError(400, `Time overlaps with "${other.module_name}"`);
  }
}

export async function updateModule(
  supabase: DbClient,
  id: number,
  input: z.infer<typeof moduleSchema>,
  actorId: number,
): Promise<NonNullable<Awaited<ReturnType<typeof courseDao.updateModule>>>> {
  if (input.speaker_profile_id !== undefined && input.speaker_profile_id !== null) {
    await ensureSpeakerAssigned(supabase, id, input.speaker_profile_id);
  }

  await mergeConflictingTimes(supabase, id, input);

  const mod = await courseDao.updateModule(supabase, id, {
    module_name: input.module_name,
    sequence_order: input.sequence_order,
    ...(input.start_time !== undefined && { start_time: input.start_time, end_time: input.end_time }),
    ...(input.speaker_profile_id !== undefined && { speaker_profile_id: input.speaker_profile_id }),
  });

  if (!mod) {
    throw new CourseModuleServiceError(500, "Failed to update module");
  }

  await logAuditEvent(supabase, actorId, "module.updated", "module", id, {
    changes: Object.keys(input),
  });

  return mod;
}

export async function deleteModuleWithStorage(supabase: DbClient, id: number, actorId: number): Promise<{ success: true }> {
  const mod = await courseDao.findModuleById(supabase, id);
  if (mod) {
    const lessons = await courseDao.findLessonsByModule(supabase, id);
    for (const lesson of lessons) {
      const folder = `courses/${mod.course_id}/modules/${id}/lessons/${lesson.id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const ok = await courseDao.deleteModule(supabase, id);

  if (!ok) {
    throw new CourseModuleServiceError(500, "Failed to delete module");
  }

  await logAuditEvent(supabase, actorId, "module.deleted", "module", id, {
    course_id: mod?.course_id,
  });

  return { success: true };
}
