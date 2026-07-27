import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { ticketDao } from "@/lib/db/dao";

interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id: eventId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)));

  const supabase = getServiceClient();

  const { data: rawAttendees, total } = await ticketDao.getAttendees(supabase, Number(eventId), {
    search,
    status,
    page,
    limit,
  });

  const attendees: AttendeeRow[] = (
    (rawAttendees ?? []) as {
      USER: { id: number; full_name: string; email: string } | null;
      status: string;
      issued_at: string;
      updated_at: string;
    }[]
  ).map((row) => ({
    user_id: row.USER?.id ?? 0,
    full_name: row.USER?.full_name ?? "Unknown",
    email: row.USER?.email ?? "",
    ticket_status: row.status as AttendeeRow["ticket_status"],
    issued_at: row.issued_at,
    checked_in_at: row.status === "checked_in" ? row.updated_at : null,
  }));

  return NextResponse.json({ attendees, total, page, limit });
}
