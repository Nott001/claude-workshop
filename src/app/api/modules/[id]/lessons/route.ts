import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { lessonSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;
  const supabase = getServiceClient();

  const body = await req.json();
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const lesson = await courseDao.createLesson(supabase, {
    module_id: Number(id),
    description: parsed.data.description,
    content_type: parsed.data.content_type,
    content_url: parsed.data.content_url ?? undefined,
    sequence_order: parsed.data.sequence_order,
  });

  if (!lesson) {
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "lesson.created", "lesson", lesson.id, {
    module_id: Number(id),
    description: lesson.description,
  });

  return NextResponse.json(lesson, { status: 201 });
}
