import { createHmac, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { appBaseUrl } from "@/shared/lib/app-url";
import type {
  CreatePaymentOptions,
  CreatePaymentResult,
  PaymentGateway,
  RefundOptions,
  RefundResult,
  WebhookConfirmation,
  WebhookResult,
} from "../payment-gateway";
import { PaymentWebhookError } from "../payment-gateway";
import { fulfillPaidPayment, fulfillmentInputFrom, markPaymentFailed, markPaymentRefunded } from "../fulfillment";

export interface HitPaySettings {
  apiKey: string;
  /** Webhook salt, used to verify the Hitpay-Signature header. */
  salt: string;
  baseUrl: string;
  paymentMethods: string[];
}

interface HitPayWebhookBody {
  id?: string;
  status?: "pending" | "completed" | "failed" | "expired" | "canceled" | "inactive";
}

/**
 * HitPay's hosted checkout: create a payment request, return its checkout URL,
 * and let the signed webhook confirm the result. Confirmation never trusts the
 * browser's return redirect — anyone can hit that URL — only the HMAC webhook.
 */
export class HitPayPaymentGateway implements PaymentGateway {
  constructor(private readonly settings: HitPaySettings) {}

  async createPayment(options: CreatePaymentOptions): Promise<CreatePaymentResult> {
    const body = new URLSearchParams({
      amount: options.amount.toFixed(2),
      currency: options.currency,
      email: options.user_email,
      name: options.user_name,
      purpose: `Ticket for ${options.event.title}`,
      // HitPay returns the buyer here; our checkout page polls until the
      // webhook settles the payment.
      redirect_url: `${appBaseUrl()}/checkout/${options.payment_id}`,
      reference_number: String(options.payment_id),
      // We issue the ticket email ourselves, so HitPay should not send its own.
      send_email: "false",
    });

    for (const method of this.settings.paymentMethods) {
      body.append("payment_methods[]", method);
    }

    const res = await fetch(`${this.settings.baseUrl}/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "X-BUSINESS-API-KEY": this.settings.apiKey,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`HitPay create payment request failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { id: string; url: string };
    return { checkout_url: data.url, gateway_reference_id: data.id };
  }

  async confirmWebhook({ payload, signature }: WebhookConfirmation): Promise<WebhookResult> {
    if (!signature) {
      throw new PaymentWebhookError("Missing Hitpay-Signature header", 401);
    }

    const expected = createHmac("sha256", this.settings.salt).update(payload).digest("hex");
    const actual = signature.toLowerCase();
    // timingSafeEqual throws on differing lengths, which a malformed header
    // would turn into a 500. A wrong-sized signature is just invalid.
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(actual, "utf8");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new PaymentWebhookError("Invalid webhook signature", 400);
    }

    let body: HitPayWebhookBody;
    try {
      body = JSON.parse(payload) as HitPayWebhookBody;
    } catch {
      throw new PaymentWebhookError("Webhook payload is not valid JSON", 400);
    }

    if (!body.id) return { outcome: "ignored" };

    const supabase = getServiceClient();
    const payment = await paymentDao.findByGatewayReference(supabase, body.id);
    if (!payment) return { outcome: "ignored" };

    switch (body.status) {
      case "completed":
        await fulfillPaidPayment(supabase, fulfillmentInputFrom(payment));
        return { outcome: "paid" };
      case "failed":
        await markPaymentFailed(supabase, payment.id);
        return { outcome: "failed" };
      default:
        // pending, expired, canceled, inactive: nothing to settle yet.
        return { outcome: "ignored" };
    }
  }

  async refund({ payment_id, amount }: RefundOptions): Promise<RefundResult> {
    const supabase = getServiceClient();
    const payment = await paymentDao.findById(supabase, payment_id);
    if (!payment) {
      throw new Error("Payment not found");
    }
    if (!payment.gateway_reference_id) {
      throw new Error("Payment has no gateway reference to refund");
    }

    const res = await fetch(`${this.settings.baseUrl}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-BUSINESS-API-KEY": this.settings.apiKey,
      },
      body: JSON.stringify({
        amount: amount ?? payment.amount,
        payment_id: payment.gateway_reference_id,
        send_email: "false",
      }),
    });

    if (!res.ok) {
      throw new Error(`HitPay refund failed (${res.status}): ${await res.text()}`);
    }

    await markPaymentRefunded(supabase, payment_id);
    return { refunded: true };
  }
}
