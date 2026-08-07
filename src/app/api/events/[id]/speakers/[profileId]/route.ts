import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id, profileId } = await params;
  const supabase = getServiceClient();

  const ok = await speakerDao.unassignFromEvent(supabase, Number(id), Number(profileId));

  if (!ok) {
    return NextResponse.json({ error: "Failed to unassign speaker" }, { status: 500 });
  }

  await courseDao.clearModuleSpeakerForEvent(supabase, Number(id), Number(profileId));

  await logAuditEvent(supabase, guard.user.id, "speaker.unassigned", "speaker_profile", Number(profileId), {
    event_id: Number(id),
  });

  return NextResponse.json({ success: true });
}
