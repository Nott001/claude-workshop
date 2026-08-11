import { NextResponse } from "next/server";
import { getPaymentGateway, PaymentWebhookError } from "@/modules/commerce/lib/payment-gateway";

/**
 * Inbound payment confirmation. The provider signs the raw body with its salt,
 * and the adapter verifies that before touching anything — this route is public
 * in the middleware, so the signature is the credential. Always answer 2xx for
 * a valid webhook or the provider keeps retrying.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("Hitpay-Signature");

  try {
    const result = await getPaymentGateway().confirmWebhook({ payload, signature });
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    if (err instanceof PaymentWebhookError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Payment webhook processing failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
