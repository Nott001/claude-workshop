import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, listAdminEventAttendees, loadEventOr403 } from "@/modules/events/lib/event-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)));

  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let event;
  try {
    event = await loadEventOr403(supabase, Number(eventId), user, "attendees_manage");
  } catch (err) {
    return mapError(err);
  }

  const result = await listAdminEventAttendees(supabase, event, { search, status, page, limit });

  return NextResponse.json(result);
}
