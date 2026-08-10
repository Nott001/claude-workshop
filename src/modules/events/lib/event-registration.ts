import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import * as eventDao from "@/modules/events/db/event.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";

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

  const activeTicket = await ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, id);

  if (activeTicket) {
    throw new EventServiceError(409, "You already have an active ticket for this event");
  }

  const existingPending = await paymentDao.findPendingByUserAndEvent(supabase, user.id, id);

  if (existingPending) {
    return { eligible: true, pending_payment_id: existingPending.id };
  }

  return { eligible: true };
}
