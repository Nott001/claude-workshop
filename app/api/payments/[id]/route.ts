import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase
    .from("USERS")
    .select("user_id, role")
    .eq("clerk_id", (await auth()).userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase.from("PAYMENTS").select("*, EVENTS(title)").eq("payment_id", id);

  if (dbUser.role === "attendee") {
    query = query.eq("user_id", dbUser.user_id);
  }

  const { data: payment, error } = await query.single();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(payment);
}
