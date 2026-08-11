import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { sendEmailNotification } from "@/shared/integrations/email/send-notification";
import { afterResponse } from "@/shared/lib/after-response";
import { appBaseUrl } from "@/shared/lib/app-url";
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
  /**
   * Supplied by the caller, which has already loaded the event to price the
   * payment. Re-reading it here cost a second round trip for the same row.
   */
  event: { title: string; event_date: string };
}

export interface CreatePaymentResult {
  checkout_url: string;
}

export interface PaymentGateway {
  createPayment(options: CreatePaymentOptions): Promise<CreatePaymentResult>;
}

export function buildCheckoutUrl(paymentId: number, appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  return `${appBaseUrl(appUrl)}/checkout/${paymentId}?success=true`;
}

export class SimulatedPaymentGateway implements PaymentGateway {
  async createPayment({
    payment_id,
    user_id,
    event_id,
    user_email,
    user_name,
    event,
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

    // Deferred: the SMTP round trip runs a couple of seconds and occasionally
    // stalls until the session timeout, none of which a buyer waiting on their
    // ticket should be made to sit through. The QR is rendered here too because
    // nothing but the email needs it.
    afterResponse(async () => {
      await sendEmailNotification({
        user_id,
        email: user_email,
        name: user_name,
        email_type: "ticket_issued",
        eventTitle: event.title,
        eventDate: event.event_date,
        qrDataUrl: await generateQRDataUrl(qrToken),
      });
    });

    return { checkout_url: buildCheckoutUrl(payment_id) };
  }
}
