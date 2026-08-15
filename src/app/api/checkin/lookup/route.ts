import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { checkinSchema, formatTicketPreview } from "@/modules/kiosk/lib/checkin";

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("qr_token") ?? "";

  const parsed = checkinSchema.safeParse({ qr_token: token });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const ticket = await ticketDao.findByQrToken(supabase, parsed.data.qr_token);

  if (!ticket) {
    return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
  }

  // Lookup only: the kiosk shows who this is and lets the operator decide
  // before the mutating POST /api/checkin is called.
  return NextResponse.json(formatTicketPreview(ticket));
}
