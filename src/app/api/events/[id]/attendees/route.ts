import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

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
  const offset = (page - 1) * limit;

  const supabase = getServiceClient();

  let query = supabase
    .from("TICKETS")
    .select("USER:user_id(user_id, full_name, email), status, issued_at, updated_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });

  if (status === "checked_in") {
    query = query.eq("status", "checked_in");
  } else if (status === "not_checked_in") {
    query = query.in("status", ["issued"]);
  }

  if (search) {
    query = query.or(`USER.full_name.ilike.%${search}%,USER.email.ilike.%${search}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attendees: AttendeeRow[] = (data ?? []).map(
    (row: {
      USER: { user_id: number; full_name: string; email: string } | null;
      status: string;
      issued_at: string;
      updated_at: string;
    }) => ({
      user_id: row.USER?.user_id ?? 0,
      full_name: row.USER?.full_name ?? "Unknown",
      email: row.USER?.email ?? "",
      ticket_status: row.status as AttendeeRow["ticket_status"],
      issued_at: row.issued_at,
      checked_in_at: row.status === "checked_in" ? row.updated_at : null,
    }),
  );

  const total = count ?? 0;

  return NextResponse.json({ attendees, total, page, limit });
}
