import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireLessonAccess } from "@/modules/courses/lib/course-access";

/**
 * Detach a lesson's material so a different file can take its place.
 *
 * The objects are found by listing the lesson's own storage folder rather than
 * by parsing `content_url`: the same lesson can hold more than one stored file
 * after a replacement, and a url is a rendering of the path, not the path. This
 * is what `DELETE /api/lessons/[id]` already does when it removes the lesson
 * outright — the only difference here is that the row survives.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireLessonAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const supabase = getServiceClient();

  const lesson = await courseDao.findLessonModule(supabase, Number(id));
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const mod = await courseDao.findModuleCourse(supabase, lesson.module_id);
  if (mod) {
    const folder = `courses/${mod.course_id}/modules/${lesson.module_id}/lessons/${id}`;
    const [assetPaths, videoPaths] = await Promise.all([
      listStorageFolder("course_assets", folder),
      listStorageFolder("course_videos", folder),
    ]);
    await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
  }

  const updated = await courseDao.updateLesson(supabase, Number(id), { content_url: null });
  if (!updated) {
    return NextResponse.json({ error: "Failed to detach the material" }, { status: 500 });
  }

  await requireAuditEvent(supabase, guard.user.id, "lesson.updated", "lesson", Number(id), {
    material: "removed",
  });

  return NextResponse.json(updated);
}
