import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { courseDao } from "@/lib/db/dao";
import { lessonSchema } from "@/modules/course-content";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const lesson = await courseDao.findLessonById(supabase, Number(id));

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
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

  const lesson = await courseDao.updateLesson(supabase, Number(id), updateData);

  if (!lesson) {
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "lesson.updated", "lesson", Number(id), {
      changes: Object.keys(parsed.data),
    });
  }

  return NextResponse.json(lesson);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();
  const { userId } = await auth();

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

  if (userId) {
    await logAuditEvent(supabase, userId, "lesson.deleted", "lesson", Number(id), {
      module_id: lesson?.module_id,
    });
  }

  return NextResponse.json({ success: true });
}
