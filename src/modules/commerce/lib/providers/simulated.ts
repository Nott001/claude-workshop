import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import type {
  CreatePaymentOptions,
  CreatePaymentResult,
  PaymentGateway,
  RefundOptions,
  RefundResult,
  WebhookConfirmation,
  WebhookResult,
} from "../payment-gateway";
import { fulfillPaidPayment, fulfillmentInputFrom, markPaymentFailed, markPaymentRefunded } from "../fulfillment";

interface SimulatedWebhookBody {
  /** The gateway reference (our payment id, as a string) to settle. */
  reference?: string;
  status?: "completed" | "failed" | "pending";
}

/**
 * Settles a payment the moment it is created — no network involved — so local
 * development and the e2e suite can run without provider credentials. Selected
 * from config/payments.yaml like any other provider; nothing about the app
 * knows it is fake. It also answers webhooks shaped like its own payloads, so
 * the webhook route stays exercisable offline.
 */
export class SimulatedPaymentGateway implements PaymentGateway {
  async createPayment(options: CreatePaymentOptions): Promise<CreatePaymentResult> {
    const supabase = getServiceClient();
    await fulfillPaidPayment(supabase, options);
    return { checkout_url: "", gateway_reference_id: String(options.payment_id) };
  }

  async confirmWebhook({ payload }: WebhookConfirmation): Promise<WebhookResult> {
    let body: SimulatedWebhookBody;
    try {
      body = JSON.parse(payload) as SimulatedWebhookBody;
    } catch {
      return { outcome: "ignored" };
    }

    if (!body.reference) return { outcome: "ignored" };

    const supabase = getServiceClient();
    const payment = await paymentDao.findByGatewayReference(supabase, body.reference);
    if (!payment) return { outcome: "ignored" };

    switch (body.status) {
      case "completed":
        await fulfillPaidPayment(supabase, fulfillmentInputFrom(payment));
        return { outcome: "paid" };
      case "failed":
        await markPaymentFailed(supabase, payment.id);
        return { outcome: "failed" };
      default:
        return { outcome: "ignored" };
    }
  }

  async refund({ payment_id }: RefundOptions): Promise<RefundResult> {
    const supabase = getServiceClient();
    await markPaymentRefunded(supabase, payment_id);
    return { refunded: true };
  }
}
