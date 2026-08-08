import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireCourseAccess } from "@/modules/courses/lib/course-access";

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { courseId } = await params;
  const accessError = await requireCourseAccess(Number(courseId), guard.user.id, guard.user.role);
  if (accessError) return accessError;
  const supabase = getServiceClient();

  const body = await req.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mod = await courseDao.createModule(supabase, {
    course_id: Number(courseId),
    module_name: parsed.data.module_name,
    sequence_order: parsed.data.sequence_order,
    module_type: parsed.data.module_type,
  });

  if (!mod) {
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }

  await requireAuditEvent(supabase, guard.user.id, "module.created", "module", mod.id, {
    course_id: Number(courseId),
    name: mod.module_name,
  });

  return NextResponse.json(mod, { status: 201 });
}
