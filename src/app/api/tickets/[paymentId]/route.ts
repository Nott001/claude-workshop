import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { ticketDao } from "@/lib/db/dao";
import { generateQRDataUrl } from "@/lib/qr";

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { paymentId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ticket = await ticketDao.findWithPaymentAndEvent(supabase, Number(paymentId));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (user.role === "attendee" && (ticket as { user_id: number }).user_id !== user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const qrDataUrl = await generateQRDataUrl((ticket as { qr_token: string }).qr_token);

  return NextResponse.json({ ...ticket, qr_data_url: qrDataUrl });
}
