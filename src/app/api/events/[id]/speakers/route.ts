import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { speakerDao } from "@/lib/db/dao";
import { speakerAssignmentSchema } from "@/modules/event-management";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const assignments = await speakerDao.listEventAssignments(supabase, Number(id));

  return NextResponse.json(assignments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
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

  const user = await requireAuth(supabase);
  if (user) {
    await logAuditEvent(supabase, user.id, "speaker.assigned", "speaker_profile", parsed.data.speaker_profile_id, {
      event_id: Number(id),
    });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
