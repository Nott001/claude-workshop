import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireCourseAccess } from "@/modules/courses/lib/course-access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireCourseAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;
  const supabase = getServiceClient();

  const body = await req.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const mod = await courseDao.createModule(supabase, {
    course_id: Number(id),
    module_name: parsed.data.module_name,
    sequence_order: parsed.data.sequence_order,
    module_type: parsed.data.module_type,
  });

  if (!mod) {
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "module.created", "module", mod.id, {
    course_id: Number(id),
    name: mod.module_name,
  });

  return NextResponse.json(mod, { status: 201 });
}
