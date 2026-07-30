import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit";
import { requireCourseAccess } from "@/modules/courses/lib/course-access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
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
