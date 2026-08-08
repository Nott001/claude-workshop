import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  const { id, profileId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "edit");

    const ok = await speakerDao.unassignFromEvent(supabase, Number(id), Number(profileId));

    if (!ok) {
      return NextResponse.json({ error: "Failed to unassign speaker" }, { status: 500 });
    }

    await courseDao.clearModuleSpeakerForEvent(supabase, Number(id), Number(profileId));

    await requireAuditEvent(supabase, user.id, "speaker.unassigned", "speaker_profile", Number(profileId), {
      event_id: Number(id),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof EventServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
