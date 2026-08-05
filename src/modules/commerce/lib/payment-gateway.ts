import { getServiceClient } from "@/shared/db/client";
import { paymentDao, ticketDao } from "@/shared/db/dao";
import { sendEmailNotification } from "@/modules/notifications/lib/email";
import { afterResponse } from "@/shared/lib/after-response";
import { appBaseUrl } from "@/shared/lib/app-url";
import { generateQRDataUrl } from "@/shared/integrations/qr";
import type { CreatePaymentOptions, CreatePaymentResult, PaymentGateway } from "../index";
import { generateQrToken } from "../index";

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
