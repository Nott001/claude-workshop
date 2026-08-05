import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { sendEmailNotification } from "@/modules/notifications/lib/email";
import { afterResponse } from "@/shared/lib/after-response";
import { generateQRDataUrl } from "@/shared/integrations/qr";
import { generateQrToken } from "./payment-state";

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

/**
 * NEXT_PUBLIC_APP_URL is hand-entered configuration, so it may or may not carry
 * a trailing slash — the deployed value does, which produced `//checkout/123`.
 * Normalising here keeps every caller from having to know that.
 */
export function buildCheckoutUrl(paymentId: number, appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  const base = (appUrl?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/checkout/${paymentId}?success=true`;
}

export class SimulatedPaymentGateway implements PaymentGateway {
  async createPayment({
    payment_id,
    user_id,
    event_id,
    user_email,
    user_name,
  }: CreatePaymentOptions): Promise<CreatePaymentResult> {
    const supabase = getServiceClient();

    const updated = await paymentDao.updateStatus(supabase, payment_id, "paid");
    if (!updated) {
      throw new Error(`Failed to mark payment as paid`);
    }

    const qrToken = generateQrToken();
    const ticket = await ticketDao.create(supabase, {
      payment_id,
      user_id,
      event_id,
      qr_token: qrToken,
    });

    if (!ticket) {
      throw new Error(`Failed to issue ticket`);
    }

    const eventData = await paymentDao.findEventForPayment(supabase, event_id);

    if (eventData) {
      // Deferred: the SMTP round trip runs about four seconds and occasionally
      // stalls until the session timeout, none of which a buyer waiting on
      // their ticket should be made to sit through. The QR is rendered here too
      // because nothing but the email needs it.
      afterResponse(async () => {
        await sendEmailNotification({
          user_id,
          email: user_email,
          name: user_name,
          email_type: "ticket_issued",
          eventTitle: eventData.title,
          eventDate: eventData.event_date,
          qrDataUrl: await generateQRDataUrl(qrToken),
        });
      });
    }

    return { checkout_url: buildCheckoutUrl(payment_id) };
  }
}
