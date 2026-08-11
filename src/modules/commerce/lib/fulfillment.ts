import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { sendEmailNotification } from "@/shared/integrations/email/send-notification";
import { afterResponse } from "@/shared/lib/after-response";
import { generateQRDataUrl } from "@/shared/integrations/qr";
import type { DbClient } from "@/shared/db/dao/types";
import type { PaymentWithEventAndUser } from "@/shared/db/dao/payment.dao";
import { canTransitionPayment, generateQrToken } from "./payment-state";

export interface FulfillmentInput {
  payment_id: number;
  user_id: number;
  event_id: number;
  user_email: string;
  user_name: string;
  event: { title: string; event_date: string };
}

/** Maps a payment row (with its USER/EVENT embeds) to what fulfillment needs. */
export function fulfillmentInputFrom(payment: PaymentWithEventAndUser): FulfillmentInput {
  return {
    payment_id: payment.id,
    user_id: payment.user_id,
    event_id: payment.event_id,
    user_email: payment.USER?.email ?? "",
    user_name: payment.USER?.full_name ?? "",
    event: { title: payment.EVENT?.title ?? "", event_date: payment.EVENT?.event_date ?? "" },
  };
}

/**
 * The paid-payment workflow, shared by every provider. A real gateway confirms
 * payment via webhook, a simulated one calls this directly from createPayment —
 * both settle the same way: mark paid, issue a QR ticket, email it. The
 * transition guard and idempotence make a duplicate webhook harmless.
 */
export async function fulfillPaidPayment(supabase: DbClient, input: FulfillmentInput): Promise<void> {
  const payment = await paymentDao.findById(supabase, input.payment_id);
  if (!payment) {
    throw new Error(`Payment ${input.payment_id} not found`);
  }

  if (payment.status === "paid") return;
  if (!canTransitionPayment(payment.status, "paid")) {
    throw new Error(`Payment ${payment.id} cannot be marked paid from ${payment.status}`);
  }

  const updated = await paymentDao.updateStatus(supabase, input.payment_id, "paid");
  if (!updated) {
    throw new Error(`Failed to mark payment as paid`);
  }

  const qrToken = generateQrToken();
  const ticket = await ticketDao.create(supabase, {
    payment_id: input.payment_id,
    user_id: input.user_id,
    event_id: input.event_id,
    qr_token: qrToken,
  });

  if (!ticket) {
    throw new Error(`Failed to issue ticket`);
  }

  // Deferred: the SMTP round trip runs a couple of seconds and occasionally
  // stalls until the session timeout, none of which a buyer waiting on their
  // ticket should be made to sit through. The QR is rendered here too because
  // nothing but the email needs it.
  afterResponse(async () => {
    await sendEmailNotification({
      user_id: input.user_id,
      email: input.user_email,
      name: input.user_name,
      email_type: "ticket_issued",
      eventTitle: input.event.title,
      eventDate: input.event.event_date,
      qrDataUrl: await generateQRDataUrl(qrToken),
    });
  });
}

export async function markPaymentFailed(supabase: DbClient, paymentId: number): Promise<void> {
  const payment = await paymentDao.findById(supabase, paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (payment.status === "failed") return;
  if (!canTransitionPayment(payment.status, "failed")) {
    throw new Error(`Payment ${payment.id} cannot be marked failed from ${payment.status}`);
  }

  const updated = await paymentDao.updateStatus(supabase, paymentId, "failed");
  if (!updated) {
    throw new Error(`Failed to mark payment as failed`);
  }
}

export async function markPaymentRefunded(supabase: DbClient, paymentId: number): Promise<void> {
  const payment = await paymentDao.findById(supabase, paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  if (payment.status === "refunded") return;
  if (!canTransitionPayment(payment.status, "refunded")) {
    throw new Error(`Payment ${payment.id} cannot be marked refunded from ${payment.status}`);
  }

  const updated = await paymentDao.updateStatus(supabase, paymentId, "refunded");
  if (!updated) {
    throw new Error(`Failed to mark payment as refunded`);
  }

  // A refund voids the entitlement: the ticket would otherwise stay live.
  const ticket = await ticketDao.findByPaymentId(supabase, paymentId);
  if (ticket && ticket.status !== "cancelled") {
    await ticketDao.updateStatus(supabase, ticket.id, "cancelled");
  }
}
