import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { speakerAssignmentSchema } from "@/modules/events/lib/schemas";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  // The roster is the co-presenter list the builder offers for module
  // assignments, so an assigned speaker may read it for their event too. A
  // staff member passes through; only an exact speaker needs the assignment.
  if (guard.user.role === "speaker" && !(await speakerDao.isAssignedByUserId(supabase, guard.user.id, Number(id)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignments = await speakerDao.listEventAssignments(supabase, Number(id));

  return NextResponse.json(assignments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = speakerAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "edit");

    const ok = await speakerDao.assignToEvent(supabase, Number(id), parsed.data.speaker_profile_id);

    if (!ok) {
      return NextResponse.json({ error: "Failed to assign speaker" }, { status: 500 });
    }

    await logAuditEvent(supabase, user.id, "speaker.assigned", "speaker_profile", parsed.data.speaker_profile_id, {
      event_id: Number(id),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof EventServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
