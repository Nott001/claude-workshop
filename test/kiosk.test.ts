import { describe, it, expect } from "vitest";
import { checkinSchema, formatCheckinResult } from "@/modules/kiosk/lib/checkin";
import type { TicketStatus } from "@/shared/types";

describe("checkinSchema", () => {
  it("accepts valid qr_token", () => {
    const result = checkinSchema.safeParse({ qr_token: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty qr_token", () => {
    const result = checkinSchema.safeParse({ qr_token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing qr_token", () => {
    const result = checkinSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("formatCheckinResult", () => {
  const baseTicket = {
    USER: { full_name: "Jane Doe", email: "jane@example.com" },
    payment_id: 1,
    user_id: 5,
    event_id: 10,
  };

  it("returns success for issued ticket", () => {
    const result = formatCheckinResult({ ...baseTicket, status: "issued" as TicketStatus });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.attendee.full_name).toBe("Jane Doe");
      expect(result.attendee.email).toBe("jane@example.com");
    }
  });

  it("returns duplicate for checked_in ticket", () => {
    const result = formatCheckinResult({ ...baseTicket, status: "checked_in" as TicketStatus });
    expect(result.status).toBe("duplicate");
    if (result.status === "duplicate") {
      expect(result.ticket.status).toBe("checked_in");
      expect(result.ticket.payment_id).toBe(1);
    }
  });

  it("returns rejected for cancelled ticket", () => {
    const result = formatCheckinResult({ ...baseTicket, status: "cancelled" as TicketStatus });
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("cancelled");
    }
  });

  it("handles missing user gracefully", () => {
    const result = formatCheckinResult({
      ...baseTicket,
      status: "issued" as TicketStatus,
      USER: null,
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.attendee.full_name).toBe("Unknown");
    }
  });
});
