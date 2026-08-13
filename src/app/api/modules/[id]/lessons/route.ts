import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { lessonSchema } from "@/modules/courses/lib/schemas";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
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
    name: parsed.data.name,
    description: parsed.data.description ?? undefined,
    content_type: parsed.data.content_type,
    content_url: parsed.data.content_url ?? undefined,
    sequence_order: parsed.data.sequence_order,
  });

  if (!lesson) {
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }

  await requireAuditEvent(supabase, guard.user.id, "lesson.created", "lesson", lesson.id, {
    module_id: Number(id),
    name: lesson.name,
  });

  return NextResponse.json(lesson, { status: 201 });
}
