import { z } from "zod";
import type { TicketStatus } from "@/types";

export const checkinSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
});

export type CheckinResult =
  | { status: "success"; attendee: { full_name: string; email: string } }
  | { status: "duplicate"; ticket: { status: TicketStatus } }
  | { status: "rejected"; reason: string };

export function formatCheckinResult(ticket: {
  status: TicketStatus;
  USER?: { full_name: string; email: string } | null;
}): CheckinResult {
  if (ticket.status === "checked_in") {
    return { status: "duplicate", ticket: { status: ticket.status } };
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
