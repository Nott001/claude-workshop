import { describe, it, expect } from "vitest";
import {
  paymentInitSchema,
  canTransitionPayment,
  canTransitionTicket,
  generateQrToken,
  isPaymentTerminal,
} from "@/modules/commerce";
import type { Payment, Ticket, PaymentStatus, TicketStatus } from "@/types";

describe("Payment and Ticket types", () => {
  it("Payment interface has correct shape", () => {
    const payment: Payment = {
      payment_id: 1,
      user_id: 1,
      event_id: 1,
      hitpay_reference_id: "ref_123",
      status: "pending",
      paid_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(payment.status).toBe("pending");
    expect(payment.hitpay_reference_id).toBe("ref_123");
  });

  it("Ticket interface has correct shape", () => {
    const ticket: Ticket = {
      payment_id: 1,
      user_id: 1,
      event_id: 1,
      qr_token: "abc123",
      status: "issued",
      issued_at: "2026-01-01T00:00:00Z",
      checked_in_by: null,
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
