import crypto from "crypto";

const HITPAY_API_KEY = process.env.HITPAY_API_KEY!;
const HITPAY_API_SECRET = process.env.HITPAY_API_SECRET!;
const HITPAY_SALT = process.env.HITPAY_SALT!;
const HITPAY_BASE_URL = process.env.HITPAY_BASE_URL ?? "https://api.sandbox.hitpayapp.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface HitPayCreatePaymentResponse {
  id: string;
  reference_id: string;
  url: string;
  status: string;
}

export async function createPayment({
  amount,
  currency = "SGD",
  reference_id,
  name,
  email,
}: {
  amount: number;
  currency?: string;
  reference_id: string;
  name: string;
  email: string;
}): Promise<HitPayCreatePaymentResponse> {
  const body = new URLSearchParams({
    amount: amount.toFixed(2),
    currency,
    reference_id,
    name,
    email,
    redirect_url: `${APP_URL}/checkout/${reference_id}?success=true`,
    webhook: `${APP_URL}/api/payments/webhook`,
  });

  const res = await fetch(`${HITPAY_BASE_URL}/v1/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Api-Key": HITPAY_API_KEY,
      "X-Api-Secret": HITPAY_API_SECRET,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HitPay create payment failed: ${res.status} ${text}`);
  }

  return res.json();
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const computed = crypto.createHmac("sha256", HITPAY_SALT).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
