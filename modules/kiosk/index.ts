import { z } from "zod";
import type { Ticket, TicketStatus } from "@/types";

export const checkinSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
});

export type CheckinResult =
  | { status: "success"; attendee: { full_name: string; email: string } }
  | { status: "duplicate"; ticket: Pick<Ticket, "status" | "payment_id" | "user_id" | "event_id"> }
  | { status: "rejected"; reason: string };

export function formatCheckinResult(ticket: {
  status: TicketStatus;
  payment_id?: number;
  user_id?: number;
  event_id?: number;
  USER?: { full_name: string; email: string } | null;
}): CheckinResult {
  if (ticket.status === "checked_in") {
    return {
      status: "duplicate",
      ticket: {
        status: ticket.status,
        payment_id: ticket.payment_id ?? 0,
        user_id: ticket.user_id ?? 0,
        event_id: ticket.event_id ?? 0,
      },
    };
  }
  if (ticket.status === "cancelled") {
    return { status: "rejected", reason: "cancelled" };
  }
  return {
    status: "success",
    attendee: {
      full_name: ticket.USER?.full_name ?? "Unknown",
      email: ticket.USER?.email ?? "",
    },
  };
}
