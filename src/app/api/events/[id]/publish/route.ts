import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { eventDao } from "@/lib/db/dao";
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

  const user = await requireAuth(supabase);
  if (user) {
    await logAuditEvent(supabase, user.id, "event.published", "event", Number(id));
  }

  return NextResponse.json({ success: true });
}
