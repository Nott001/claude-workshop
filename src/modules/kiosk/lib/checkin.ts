import { z } from "zod";
import type { TicketStatus } from "@/shared/types";

export const checkinSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
});

export interface TicketPreview {
  attendee: { full_name: string; email: string };
  qr_token: string;
  status: TicketStatus;
  checked_in_at: string | null;
}

interface TicketPreviewInput {
  USER: { full_name: string; email: string } | null;
  qr_token: string;
  status: TicketStatus;
  checked_in_at: string | null;
}

export function formatTicketPreview(ticket: TicketPreviewInput): TicketPreview {
  return {
    attendee: {
      full_name: ticket.USER?.full_name ?? "Unknown",
      email: ticket.USER?.email ?? "",
    },
    qr_token: ticket.qr_token,
    status: ticket.status,
    checked_in_at: ticket.checked_in_at,
  };
}

interface TicketData {
  USER: { full_name: string; email: string } | null;
  payment_id: number;
  user_id: number;
  event_id: number;
  status: TicketStatus;
}

interface CheckinSuccess {
  status: "success";
  attendee: { full_name: string; email: string };
  ticket: TicketData;
}

interface CheckinDuplicate {
  status: "duplicate";
  ticket: TicketData;
}

interface CheckinRejected {
  status: "rejected";
  reason: string;
}

type CheckinResult = CheckinSuccess | CheckinDuplicate | CheckinRejected;

export function formatCheckinResult(ticket: TicketData): CheckinResult {
  if (ticket.status === "cancelled") {
    return { status: "rejected", reason: "cancelled" };
  }

  if (ticket.status === "checked_in") {
    return { status: "duplicate", ticket };
  }

  return {
    status: "success",
    attendee: {
      full_name: ticket.USER?.full_name ?? "Unknown",
      email: ticket.USER?.email ?? "",
    },
    ticket,
  };
}
