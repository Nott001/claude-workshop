import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { lessonSchema } from "@/modules/courses/lib/schemas";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireLessonAccess } from "@/modules/courses/lib/course-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireLessonAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const supabase = getServiceClient();

  const lesson = await courseDao.findLessonById(supabase, Number(id));

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireLessonAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const body = await req.json();
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const updateData: Record<string, unknown> = {
    description: parsed.data.description,
    content_type: parsed.data.content_type,
    sequence_order: parsed.data.sequence_order,
  };
  if (parsed.data.content_url !== undefined) {
    updateData.content_url = parsed.data.content_url;
  }
  if (parsed.data.module_id !== undefined) {
    updateData.module_id = parsed.data.module_id;
  }

  const lesson = await courseDao.updateLesson(supabase, Number(id), updateData);

  if (!lesson) {
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "lesson.updated", "lesson", Number(id), {
    changes: Object.keys(parsed.data),
  });

  return NextResponse.json(lesson);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireLessonAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const supabase = getServiceClient();

  const lesson = await courseDao.findLessonModule(supabase, Number(id));
  if (lesson) {
    const mod = await courseDao.findModuleCourse(supabase, lesson.module_id);
    if (mod) {
      const folder = `courses/${mod.course_id}/modules/${lesson.module_id}/lessons/${id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const ok = await courseDao.deleteLesson(supabase, Number(id));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "lesson.deleted", "lesson", Number(id), {
    module_id: lesson?.module_id,
  });

  return NextResponse.json({ success: true });
}
