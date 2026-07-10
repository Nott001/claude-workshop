import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { emailLogFilterSchema } from "@/modules/notifications";

export async function GET(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filters = {
    email_type: searchParams.get("email_type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    user_id: searchParams.get("user_id") ?? undefined,
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
  };

  const parsed = emailLogFilterSchema.safeParse(filters);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  let query = supabase.from("EMAIL_LOGS").select("*, USER:user_id(full_name, email)").order("sent_at", { ascending: false });

  if (parsed.data.email_type) {
    query = query.eq("email_type", parsed.data.email_type);
  }

  if (parsed.data.status) {
    query = query.eq("status", parsed.data.status);
  }

  if (parsed.data.user_id) {
    query = query.eq("user_id", parsed.data.user_id);
  }

  if (parsed.data.date_from) {
    query = query.gte("sent_at", parsed.data.date_from);
  }

  if (parsed.data.date_to) {
    query = query.lte("sent_at", parsed.data.date_to);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(logs);
}
