import { describe, it, expect } from "vitest";
import { paymentDestination } from "@/modules/events/lib/event-registration-policy";

describe("paymentDestination", () => {
  it("sends the caller to checkout when the payment init returns a payment id", () => {
    expect(paymentDestination({ payment_id: 5 }, { pending: false, ok: true })).toEqual({
      kind: "checkout",
      paymentId: 5,
    });
  });

  it("prefers the payment id over the checkout url", () => {
    expect(paymentDestination({ payment_id: 5, checkout_url: "https://pay.example/x" }, { pending: false, ok: true })).toEqual({
      kind: "checkout",
      paymentId: 5,
    });
  });

  it("resumes a pending payment by id only, ignoring any checkout url", () => {
    expect(paymentDestination({ checkout_url: "https://pay.example/x" }, { pending: true, ok: true })).toEqual({
      kind: "error",
      message: "Failed to process payment",
    });
  });

  it("surfaces the server's message when a pending payment has no id", () => {
    expect(paymentDestination({ error: "Payment expired" }, { pending: true, ok: true })).toEqual({
      kind: "error",
      message: "Payment expired",
    });
  });

  it("falls back to the checkout url for a fresh flow that returned none", () => {
    expect(paymentDestination({ checkout_url: "https://pay.example/x" }, { pending: false, ok: true })).toEqual({
      kind: "checkout-url",
      url: "https://pay.example/x",
    });
  });

  it("never redirects on a failed payment init, even with a url present", () => {
    expect(paymentDestination({ checkout_url: "https://pay.example/x" }, { pending: false, ok: false })).toEqual({
      kind: "error",
      message: "Failed to initiate payment",
    });
  });

  it("reports a failed payment init's own message", () => {
    expect(paymentDestination({ error: "No gateway configured" }, { pending: false, ok: false })).toEqual({
      kind: "error",
      message: "No gateway configured",
    });
  });

  it("does nothing when a fresh flow returns neither a payment nor a url", () => {
    expect(paymentDestination({}, { pending: false, ok: true })).toEqual({ kind: "nothing" });
  });
});
