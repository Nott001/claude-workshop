import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { eventDao } from "@/shared/db/dao";
import { logAuditEvent } from "@/modules/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const event = await eventDao.findById(supabase, Number(id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "draft") {
    return NextResponse.json({ error: "Only draft events can be published" }, { status: 400 });
  }

  const ok = await eventDao.updateField(supabase, Number(id), "status", "active");

  if (!ok) {
    return NextResponse.json({ error: "Failed to publish event" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "event.published", "event", Number(id));

  return NextResponse.json({ success: true });
}
