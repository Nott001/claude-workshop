import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { logAuditEvent } from "@/modules/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; profileId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id, profileId } = await params;
  const supabase = getServiceClient();

  const { error } = await supabase.from("EVENT_SPEAKERS").delete().eq("event_id", id).eq("speaker_profile_id", profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "speaker.unassigned", "speaker_profile", Number(profileId), {
      event_id: Number(id),
    });
  }

  return NextResponse.json({ success: true });
}
