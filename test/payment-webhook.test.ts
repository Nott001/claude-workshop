import { describe, it, expect, vi, beforeEach } from "vitest";

const { confirmWebhook } = vi.hoisted(() => ({ confirmWebhook: vi.fn() }));

vi.mock("@/modules/commerce/lib/payment-gateway", () => ({
  getPaymentGateway: () => ({ confirmWebhook }),
  PaymentWebhookError: class PaymentWebhookError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
      this.name = "PaymentWebhookError";
    }
  },
}));

import { POST } from "@/app/api/payments/webhook/route";
import { PaymentWebhookError } from "@/modules/commerce/lib/payment-gateway";

const payload = JSON.stringify({ id: "hp_123", status: "completed" });

const post = (signature: string | null) =>
  new Request("https://app.test/api/payments/webhook", {
    method: "POST",
    headers: signature ? { "Hitpay-Signature": signature } : {},
    body: payload,
  });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/payments/webhook", () => {
  it("forwards the raw body and signature header to the provider", async () => {
    confirmWebhook.mockResolvedValue({ outcome: "paid" });

    const res = await POST(post("deadbeef"));

    expect(confirmWebhook).toHaveBeenCalledWith({ payload, signature: "deadbeef" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "paid" });
  });

  it("forwards a null signature when the header is absent", async () => {
    confirmWebhook.mockResolvedValue({ outcome: "ignored" });

    const res = await POST(post(null));

    expect(confirmWebhook).toHaveBeenCalledWith({ payload, signature: null });
    expect(await res.json()).toEqual({ received: true, outcome: "ignored" });
  });

  it("answers the adapter's rejection status for a bad signature", async () => {
    confirmWebhook.mockRejectedValue(new PaymentWebhookError("Invalid webhook signature", 400));

    const res = await POST(post("forged"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid webhook signature" });
  });

  it("answers 500 for an unexpected adapter failure", async () => {
    confirmWebhook.mockRejectedValue(new Error("db gone"));

    const res = await POST(post("deadbeef"));

    expect(res.status).toBe(500);
  });
});
