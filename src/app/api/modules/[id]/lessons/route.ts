import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { lessonSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const course = await courseDao.findCourseByModule(supabase, Number(id));
  if (!course) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  if (course.created_by !== guard.user.id) {
    if (!hasMinRole(guard.user.role, "facilitator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

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
