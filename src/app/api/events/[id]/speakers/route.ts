import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { speakerDao } from "@/shared/db/dao";
import { speakerAssignmentSchema } from "@/modules/events/lib/schemas";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const assignments = await speakerDao.listEventAssignments(supabase, Number(id));

  return NextResponse.json(assignments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = speakerAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const ok = await speakerDao.assignToEvent(supabase, Number(id), parsed.data.speaker_profile_id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to assign speaker" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "speaker.assigned", "speaker_profile", parsed.data.speaker_profile_id, {
    event_id: Number(id),
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
