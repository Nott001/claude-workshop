import { appBaseUrl } from "@/shared/lib/app-url";
import { loadPaymentConfig } from "./payment-config";
import { HITPAY_BASE_URLS, readHitPayConfig } from "./providers/hitpay-config";
import { HitPayPaymentGateway } from "./providers/hitpay";
import { SimulatedPaymentGateway } from "./providers/simulated";

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
  /**
   * The provider's id for the payment, persisted on our PAYMENT row so an
   * inbound webhook can map back to it.
   */
  gateway_reference_id: string;
}

export interface WebhookConfirmation {
  /** The raw request body, exactly as the provider signed it. */
  payload: string;
  /** The provider's signature header, if it sent one. */
  signature: string | null;
}

export type WebhookOutcome = "paid" | "failed" | "ignored";

export interface WebhookResult {
  outcome: WebhookOutcome;
}

export interface RefundOptions {
  payment_id: number;
  /** Omit to refund the full amount. */
  amount?: number;
}

export interface RefundResult {
  refunded: boolean;
}

/**
 * A payment provider behind a signature that does not change when the vendor
 * does. `createPayment` opens a checkout; `confirmWebhook` settles one (the
 * provider proves payment server-to-server); `refund` gives money back. Swap
 * providers by editing config/payments.yaml, never by touching call sites.
 */
export interface PaymentGateway {
  createPayment(options: CreatePaymentOptions): Promise<CreatePaymentResult>;
  confirmWebhook(confirmation: WebhookConfirmation): Promise<WebhookResult>;
  refund(options: RefundOptions): Promise<RefundResult>;
}

/**
 * A webhook we deliberately reject. Carries the HTTP status the route should
 * answer, so a forged signature is a 4xx and an internal failure a 5xx.
 */
export class PaymentWebhookError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentWebhookError";
  }
}

export function buildCheckoutUrl(paymentId: number, appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  return `${appBaseUrl(appUrl)}/checkout/${paymentId}?success=true`;
}

let instance: PaymentGateway | null = null;

/**
 * Picks the provider from config/payments.yaml and hands it the secrets it
 * needs out of the environment. The seam is the point of the exercise: adding
 * a provider is one case here, one class, one config line.
 */
export function createDefaultPaymentGateway(env: Record<string, string | undefined> = process.env): PaymentGateway {
  const config = loadPaymentConfig();

  switch (config.provider) {
    case "hitpay": {
      const hitPay = readHitPayConfig(env);
      if (!hitPay) {
        throw new Error("provider is 'hitpay' but PAYMENT_API_KEY or PAYMENT_WEBHOOK_SALT is not set");
      }
      return new HitPayPaymentGateway({
        ...hitPay,
        baseUrl: HITPAY_BASE_URLS[config.hitpay.environment],
        paymentMethods: config.hitpay.payment_methods,
      });
    }
    case "simulated":
      return new SimulatedPaymentGateway();
  }
}

/** Tests and the odd special case inject a provider; everything else calls getPaymentGateway(). */
export function configurePaymentGateway(gateway: PaymentGateway): void {
  instance = gateway;
}

/** Resolved on first use, not at module load, so the Worker env is populated. */
export function getPaymentGateway(): PaymentGateway {
  instance ??= createDefaultPaymentGateway();
  return instance;
}

export function resetPaymentGateway(): void {
  instance = null;
}
