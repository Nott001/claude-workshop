import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { paymentDao } from "@/lib/db/dao";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const payment = await paymentDao.findById(supabase, Number(id));

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (user.role === "attendee" && payment.user_id !== user.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(payment);
}
