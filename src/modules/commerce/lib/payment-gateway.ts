import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { sendEmailNotification } from "@/modules/notifications/lib/email";
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
      const qrDataUrl = await generateQRDataUrl(qrToken);
      try {
        await sendEmailNotification({
          user_id,
          email: user_email,
          name: user_name,
          email_type: "ticket_issued",
          eventTitle: eventData.title,
          eventDate: eventData.event_date,
          qrDataUrl,
        });
      } catch (emailErr) {
        console.error("Failed to send ticket email (non-fatal):", emailErr);
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return { checkout_url: `${appUrl}/checkout/${payment_id}?success=true` };
  }
}
