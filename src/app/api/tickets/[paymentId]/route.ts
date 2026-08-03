import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { ticketDao } from "@/shared/db/dao";
import { generateQRDataUrl } from "@/shared/integrations/qr";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { paymentId } = await params;
  const supabase = getServiceClient();

  const ticket = await ticketDao.findWithPaymentAndEvent(supabase, Number(paymentId));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // The response renders the ticket's QR below, so a leak here is a usable
  // check-in credential, not just a data disclosure. Everyone below facilitator
  // is held to their own ticket.
  if (!hasMinRole(guard.user.role, "facilitator") && (ticket as { user_id: number }).user_id !== guard.user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const qrDataUrl = await generateQRDataUrl((ticket as { qr_token: string }).qr_token);

  return NextResponse.json({ ...ticket, qr_data_url: qrDataUrl });
}
