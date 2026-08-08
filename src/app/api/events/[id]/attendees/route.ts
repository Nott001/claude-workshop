import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { listEventAttendees } from "@/modules/events/lib/event-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id: eventId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)));

  const supabase = getServiceClient();

  const result = await listEventAttendees(supabase, Number(eventId), { search, status, page, limit });

  return NextResponse.json(result);
}
