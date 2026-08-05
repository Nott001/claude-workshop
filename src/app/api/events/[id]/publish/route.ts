import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as eventDao from "@/shared/db/dao/event.dao";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
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
