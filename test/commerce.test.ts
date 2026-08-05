import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/db/client", () => ({
  getServiceClient: vi.fn(),
}));

import {
  paymentInitSchema,
  canTransitionPayment,
  canTransitionTicket,
  generateQrToken,
  isPaymentTerminal,
} from "@/modules/commerce/lib/payment-state";
import type { Payment, Ticket, PaymentStatus, TicketStatus } from "@/shared/types";

describe("Payment and Ticket types", () => {
  it("Payment interface has correct shape", () => {
    const payment: Payment = {
      id: 1,
      user_id: 1,
      event_id: 1,
      gateway_reference_id: null,
      status: "pending",
      paid_at: null,
      amount: 0,
      currency: "SGD",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(payment.status).toBe("pending");
  });

  it("Ticket interface has correct shape", () => {
    const ticket: Ticket = {
      id: 1,
      payment_id: 1,
      user_id: 1,
      event_id: 1,
      qr_token: "abc123",
      status: "issued",
      issued_at: "2026-01-01T00:00:00Z",
      checked_in_by: null,
      checked_in_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(ticket.qr_token).toBe("abc123");
    expect(ticket.status).toBe("issued");
  });
});

describe("paymentInitSchema", () => {
  it("accepts valid event_id", () => {
    const result = paymentInitSchema.safeParse({ event_id: "1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_id).toBe(1);
    }
  });

  it("rejects missing event_id", () => {
    const result = paymentInitSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative event_id", () => {
    const zero = paymentInitSchema.safeParse({ event_id: "0" });
    expect(zero.success).toBe(false);

    const neg = paymentInitSchema.safeParse({ event_id: "-1" });
    expect(neg.success).toBe(false);
  });

  it("rejects non-numeric event_id", () => {
    const result = paymentInitSchema.safeParse({ event_id: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("canTransitionPayment", () => {
  it("allows pending -> paid", () => {
    expect(canTransitionPayment("pending", "paid")).toBe(true);
  });

  it("allows pending -> failed", () => {
    expect(canTransitionPayment("pending", "failed")).toBe(true);
  });

  it("allows paid -> refunded", () => {
    expect(canTransitionPayment("paid", "refunded")).toBe(true);
  });

  it("rejects paid -> pending", () => {
    expect(canTransitionPayment("paid", "pending")).toBe(false);
  });

  it("rejects failed -> paid", () => {
    expect(canTransitionPayment("failed", "paid")).toBe(false);
  });

  it("rejects refunded -> any", () => {
    expect(canTransitionPayment("refunded", "paid")).toBe(false);
    expect(canTransitionPayment("refunded", "pending")).toBe(false);
    expect(canTransitionPayment("refunded", "failed")).toBe(false);
  });

  it("rejects invalid transitions for all statuses", () => {
    const statuses: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
    for (const from of statuses) {
      for (const to of statuses) {
        const allowed = (from === "pending" && (to === "paid" || to === "failed")) || (from === "paid" && to === "refunded");
        expect(canTransitionPayment(from, to)).toBe(allowed);
      }
    }
  });
});

describe("canTransitionTicket", () => {
  it("allows issued -> checked_in", () => {
    expect(canTransitionTicket("issued", "checked_in")).toBe(true);
  });

  it("allows issued -> cancelled", () => {
    expect(canTransitionTicket("issued", "cancelled")).toBe(true);
  });

  it("rejects checked_in -> any", () => {
    expect(canTransitionTicket("checked_in", "cancelled")).toBe(false);
    expect(canTransitionTicket("checked_in", "issued")).toBe(false);
  });

  it("rejects cancelled -> any", () => {
    expect(canTransitionTicket("cancelled", "issued")).toBe(false);
    expect(canTransitionTicket("cancelled", "checked_in")).toBe(false);
  });

  it("rejects invalid transitions for all statuses", () => {
    const statuses: TicketStatus[] = ["issued", "checked_in", "cancelled"];
    for (const from of statuses) {
      for (const to of statuses) {
        const allowed = from === "issued" && (to === "checked_in" || to === "cancelled");
        expect(canTransitionTicket(from, to)).toBe(allowed);
      }
    }
  });
});

describe("generateQrToken", () => {
  it("generates a 64-character hex string", () => {
    const token = generateQrToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateQrToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("isPaymentTerminal", () => {
  it("returns true for paid", () => {
    expect(isPaymentTerminal("paid")).toBe(true);
  });

  it("returns true for failed", () => {
    expect(isPaymentTerminal("failed")).toBe(true);
  });

  it("returns true for refunded", () => {
    expect(isPaymentTerminal("refunded")).toBe(true);
  });

  it("returns false for pending", () => {
    expect(isPaymentTerminal("pending")).toBe(false);
  });
});

describe("PaymentGateway interface", () => {
  it("SimulatedPaymentGateway implements PaymentGateway", async () => {
    const { SimulatedPaymentGateway } = await import("@/modules/commerce/lib/payment-gateway");
    const gateway = new SimulatedPaymentGateway();
    expect(gateway.createPayment).toBeDefined();
    expect(typeof gateway.createPayment).toBe("function");
  });
});

describe("buildCheckoutUrl", () => {
  async function build(paymentId: number, appUrl?: string) {
    const { buildCheckoutUrl } = await import("@/modules/commerce/lib/payment-gateway");
    return buildCheckoutUrl(paymentId, appUrl);
  }

  it("joins the base and path with exactly one slash", async () => {
    expect(await build(231, "https://events.example.com")).toBe("https://events.example.com/checkout/231?success=true");
  });

  it("does not double the slash when the base ends in one", async () => {
    // The deployed NEXT_PUBLIC_APP_URL has a trailing slash, which produced
    // `…dev//checkout/231` in a real purchase.
    expect(await build(231, "https://events.example.com/")).toBe("https://events.example.com/checkout/231?success=true");
  });

  it("collapses several trailing slashes", async () => {
    expect(await build(7, "https://events.example.com///")).toBe("https://events.example.com/checkout/7?success=true");
  });

  it("keeps a path prefix on the base intact", async () => {
    expect(await build(7, "https://example.com/app/")).toBe("https://example.com/app/checkout/7?success=true");
  });

  it.each([undefined, "", "   "])("falls back to localhost for %j", async (appUrl) => {
    expect(await build(1, appUrl)).toBe("http://localhost:3000/checkout/1?success=true");
  });
});
