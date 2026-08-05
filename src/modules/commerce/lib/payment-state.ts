import { z } from "zod";
import crypto from "crypto";
import type { PaymentStatus, TicketStatus } from "@/shared/types";

export const paymentStatuses: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
export const ticketStatuses: TicketStatus[] = ["issued", "checked_in", "cancelled"];

export const paymentInitSchema = z.object({
  event_id: z.coerce.number().int().positive(),
});

export const allowedPaymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["paid", "failed"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

export const allowedTicketTransitions: Record<TicketStatus, TicketStatus[]> = {
  issued: ["checked_in", "cancelled"],
  checked_in: [],
  cancelled: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return allowedPaymentTransitions[from]?.includes(to) ?? false;
}

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return allowedTicketTransitions[from]?.includes(to) ?? false;
}

export function generateQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isPaymentTerminal(status: PaymentStatus): boolean {
  return status === "paid" || status === "failed" || status === "refunded";
}
