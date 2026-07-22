import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
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
  const { data: module, error } = await supabase
    .from("MODULES")
    .insert({
      course_id: Number(id),
      module_name: parsed.data.module_name,
      sequence_order: parsed.data.sequence_order,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "module.created", "module", module.module_id, {
      course_id: Number(id),
      name: module.module_name,
    });
  }

  return NextResponse.json(module, { status: 201 });
}
