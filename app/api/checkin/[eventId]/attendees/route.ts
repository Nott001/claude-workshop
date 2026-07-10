import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { eventId } = await params;
  const supabase = getServiceClient();

  const { data: attendees, error } = await supabase
    .from("TICKETS")
    .select("USER:user_id(full_name, email), updated_at")
    .eq("event_id", eventId)
    .eq("status", "checked_in")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (attendees ?? []).map((a: { USER: { full_name: string; email: string } | null; updated_at: string }) => ({
    full_name: a.USER?.full_name ?? "Unknown",
    email: a.USER?.email ?? "",
    checked_in_at: a.updated_at,
  }));

  return NextResponse.json(result);
}
