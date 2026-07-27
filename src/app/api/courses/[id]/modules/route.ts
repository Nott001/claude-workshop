import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { courseDao } from "@/lib/db/dao";
import { moduleSchema } from "@/modules/course-content";
import { logAuditEvent } from "@/modules/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const mod = await courseDao.createModule(supabase, {
    course_id: Number(id),
    module_name: parsed.data.module_name,
    sequence_order: parsed.data.sequence_order,
  });

  if (!mod) {
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }

  const user = await requireAuth(supabase);
  if (user) {
    await logAuditEvent(supabase, user.id, "module.created", "module", mod.id, {
      course_id: Number(id),
      name: mod.module_name,
    });
  }

  return NextResponse.json(mod, { status: 201 });
}
