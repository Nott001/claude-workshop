import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { ticketDao } from "@/shared/db/dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { generateQRDataUrl } from "@/shared/integrations/qr";

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { paymentId } = await params;
  const supabase = getServiceClient();

  const ticket = await ticketDao.findWithPaymentAndEvent(supabase, Number(paymentId));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (!hasMinRole(guard.user.role, "facilitator") && (ticket as { user_id: number }).user_id !== guard.user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const qrDataUrl = await generateQRDataUrl((ticket as { qr_token: string }).qr_token);

  return NextResponse.json({ ...ticket, qr_data_url: qrDataUrl });
}
