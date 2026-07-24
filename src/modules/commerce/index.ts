import { z } from "zod";
import crypto from "crypto";
import type { PaymentStatus, TicketStatus } from "@/types";

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

export interface CreatePaymentOptions {
  amount: number;
  currency: string;
  payment_id: number;
  user_id: number;
  event_id: number;
  user_email: string;
  user_name: string;
}

export interface CreatePaymentResult {
  checkout_url: string;
}

export interface PaymentGateway {
  createPayment(options: CreatePaymentOptions): Promise<CreatePaymentResult>;
}

export class SimulatedPaymentGateway implements PaymentGateway {
  async createPayment({
    amount,
    currency,
    payment_id,
    user_id,
    event_id,
    user_email,
    user_name,
  }: CreatePaymentOptions): Promise<CreatePaymentResult> {
    const { getServiceClient } = await import("@/lib/db");
    const supabase = getServiceClient();

    const { error: updateError } = await supabase
      .from("PAYMENTS")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("payment_id", payment_id);

    if (updateError) {
      throw new Error(`Failed to mark payment as paid: ${updateError.message}`);
    }

    const qrToken = generateQrToken();
    const { error: ticketError } = await supabase.from("TICKETS").insert({
      payment_id,
      user_id,
      event_id,
      qr_token: qrToken,
    });

    if (ticketError) {
      throw new Error(`Failed to issue ticket: ${ticketError.message}`);
    }

    const { data: eventData } = await supabase.from("EVENTS").select("title, event_date").eq("event_id", event_id).single();

    if (eventData) {
      const { fireAndForgetEmailNotification } = await import("@/modules/notifications/email");
      const { generateQRDataUrl } = await import("@/lib/qr");
      const qrDataUrl = await generateQRDataUrl(qrToken);
      fireAndForgetEmailNotification({
        user_id,
        email: user_email,
        name: user_name,
        email_type: "ticket_issued",
        eventTitle: eventData.title,
        eventDate: eventData.event_date,
        qrDataUrl,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return { checkout_url: `${appUrl}/checkout/${payment_id}?success=true` };
  }
}
