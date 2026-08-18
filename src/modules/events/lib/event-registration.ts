import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { isEventFinished } from "@/shared/lib/date-utils";
import { isSoldOut, SOLD_OUT_MESSAGE } from "@/shared/lib/event-capacity";
import * as eventDao from "@/modules/events/db/event.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";

/** The registration window closes with the event, so the ticket-holder set the
 * survey mails is frozen the moment the end time passes. */
function ensureRegistrable(event: Event): void {
  if (isEventFinished(event.event_date, event.end_time)) {
    throw new EventServiceError(400, "Registration is closed — this event has ended");
  }
}

/**
 * Refuse a seat that no longer exists, before the buyer is sent to a checkout.
 *
 * Only reached for a capped event, so an uncapped one costs no ticket count.
 * The database enforces the same rule on the TICKET insert — this is the half
 * that can say so in words, not the half that makes it true.
 */
async function ensureSeatAvailable(supabase: DbClient, event: Event): Promise<void> {
  if (event.capacity == null) return;

  const attendeeCount = await eventDao.getAttendeeCount(supabase, event.id);
  if (isSoldOut(event.capacity, attendeeCount)) {
    throw new EventServiceError(409, SOLD_OUT_MESSAGE);
  }
}

export async function getEventRegistrationState(
  supabase: DbClient,
  id: number,
  user: { id: number; role: UserRole; full_name: string; email: string },
): Promise<{ event: Event; user: { user_id: number; full_name: string; email: string }; already_registered: boolean }> {
  const event = await eventDao.findById(supabase, id);

  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (event.status === "draft" && !hasMinRole(user.role, ROLES.FACILITATOR)) {
    throw new EventServiceError(404, "Event not found");
  }

  ensureRegistrable(event);

  const activeTicket = await ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, id);

  return {
    event,
    user: { user_id: user.id, full_name: user.full_name, email: user.email },
    already_registered: activeTicket !== null,
  };
}

export async function registerForEvent(
  supabase: DbClient,
  id: number,
  user: { id: number; role: UserRole },
): Promise<{ eligible: true; pending_payment_id?: number }> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (event.status === "draft" && !hasMinRole(user.role, ROLES.FACILITATOR)) {
    throw new EventServiceError(404, "Event not found");
  }

  ensureRegistrable(event);

  const activeTicket = await ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, id);

  if (activeTicket) {
    throw new EventServiceError(409, "You already have an active ticket for this event");
  }

  // After the duplicate-ticket check, so someone who already holds a seat is
  // told they are registered rather than that the event is full.
  await ensureSeatAvailable(supabase, event);

  const existingPending = await paymentDao.findPendingByUserAndEvent(supabase, user.id, id);

  if (existingPending) {
    return { eligible: true, pending_payment_id: existingPending.id };
  }

  return { eligible: true };
}
