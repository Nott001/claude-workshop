import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { generateQRDataUrl } from "@/shared/integrations/qr";
import { sendEmailNotification } from "@/shared/integrations/email/send-notification";
import { afterResponse } from "@/shared/lib/after-response";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: eventId, userId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let event;
  try {
    event = await loadEventOr403(supabase, Number(eventId), user, "attendees_manage");
  } catch (err) {
    return mapError(err);
  }

  const ticket = await ticketDao.findActiveTicketWithUser(supabase, Number(userId), Number(eventId));
  if (!ticket) {
    return NextResponse.json({ error: "No active registration found" }, { status: 404 });
  }

  const attendee = ticket.USER;
  if (!attendee) {
    return NextResponse.json({ error: "Attendee details are unavailable" }, { status: 400 });
  }

  // Same deferral as the original ticket email: nothing about re-sending it
  // should make the admin table wait on an SMTP round trip.
  afterResponse(async () => {
    await sendEmailNotification({
      user_id: ticket.user_id,
      email: attendee.email,
      name: attendee.full_name,
      email_type: "ticket_issued",
      eventTitle: event.title,
      eventDate: event.event_date,
      qrDataUrl: await generateQRDataUrl(ticket.qr_token),
    });
  });

  return NextResponse.json({ status: "queued" });
}
