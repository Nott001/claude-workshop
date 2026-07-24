import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { generateQRDataUrl } from "@/lib/qr";

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { paymentId } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase
    .from("USERS")
    .select("user_id, role")
    .eq("clerk_id", (await auth()).userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase
    .from("TICKETS")
    .select(
      "*, PAYMENTS(status, paid_at), EVENTS(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)",
    )
    .eq("payment_id", paymentId);

  if (dbUser.role === "attendee") {
    query = query.eq("user_id", dbUser.user_id);
  }

  const { data: ticket, error } = await query.single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const qrDataUrl = await generateQRDataUrl(ticket.qr_token);

  return NextResponse.json({ ...ticket, qr_data_url: qrDataUrl });
}
