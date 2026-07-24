import { describe, it, expect } from "vitest";
import { emailLogInsertSchema, emailLogFilterSchema, emailTypeEnum, emailStatusEnum } from "@/modules/notifications";
import type { EmailLog, EmailType, EmailStatus } from "@/types";
import { emailTemplates } from "@/lib/email";

describe("Email types", () => {
  it("EmailLog interface has correct shape", () => {
    const log: EmailLog = {
      log_id: 1,
      user_id: 1,
      email_type: "ticket_issued",
      status: "sent",
      sent_at: "2026-07-10T12:00:00Z",
      created_at: "2026-07-10T12:00:00Z",
      updated_at: "2026-07-10T12:00:00Z",
    };
    expect(log.email_type).toBe("ticket_issued");
    expect(log.status).toBe("sent");
  });

  it("EmailType accepts all valid values", () => {
    const types: EmailType[] = ["ticket_issued", "check_in_confirmed"];
    expect(types).toHaveLength(2);
  });

  it("EmailStatus accepts all valid values", () => {
    const statuses: EmailStatus[] = ["sent", "failed"];
    expect(statuses).toHaveLength(2);
  });
});

describe("emailTypeEnum", () => {
  it("accepts ticket_issued", () => {
    expect(emailTypeEnum.safeParse("ticket_issued").success).toBe(true);
  });

  it("accepts check_in_confirmed", () => {
    expect(emailTypeEnum.safeParse("check_in_confirmed").success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(emailTypeEnum.safeParse("invalid").success).toBe(false);
  });
});

describe("emailStatusEnum", () => {
  it("accepts sent", () => {
    expect(emailStatusEnum.safeParse("sent").success).toBe(true);
  });

  it("accepts failed", () => {
    expect(emailStatusEnum.safeParse("failed").success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(emailStatusEnum.safeParse("pending").success).toBe(false);
  });
});

describe("emailLogInsertSchema", () => {
  it("accepts valid insert data", () => {
    const result = emailLogInsertSchema.safeParse({
      user_id: 1,
      email_type: "ticket_issued",
      status: "sent",
    });
    expect(result.success).toBe(true);
  });

  it("accepts insert with sent_at", () => {
    const result = emailLogInsertSchema.safeParse({
      user_id: 1,
      email_type: "check_in_confirmed",
      status: "failed",
      sent_at: "2026-07-10T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing user_id", () => {
    const result = emailLogInsertSchema.safeParse({
      email_type: "check_in_confirmed",
      status: "sent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email_type", () => {
    const result = emailLogInsertSchema.safeParse({
      user_id: 1,
      email_type: "invalid",
      status: "sent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = emailLogInsertSchema.safeParse({
      user_id: 1,
      email_type: "ticket_issued",
      status: "pending",
    });
    expect(result.success).toBe(false);
  });
});

describe("emailTemplates", () => {
  it("exports ticketIssued template with registration + QR", () => {
    const html = emailTemplates.ticketIssued.buildHtml({
      name: "Bob",
      eventTitle: "Conference",
      eventDate: "2026-08-15",
      qrDataUrl: "data:image/png;base64,abc123",
    });
    expect(html).toContain("Registration Confirmed");
    expect(html).toContain("Ticket Issued");
    expect(html).toContain("Bob");
    expect(html).toContain("Conference");
    expect(html).toContain("data:image/png;base64,abc123");
  });

  it("exports ticketIssued template without QR", () => {
    const html = emailTemplates.ticketIssued.buildHtml({
      name: "Bob",
      eventTitle: "Conference",
      eventDate: "2026-08-15",
    });
    expect(html).toContain("Bob");
    expect(html).not.toContain("base64");
  });

  it("exports checkInConfirmed template", () => {
    const html = emailTemplates.checkInConfirmed.buildHtml({
      name: "Carol",
      eventTitle: "Meetup",
    });
    expect(html).toContain("Check-In Confirmed");
    expect(html).toContain("Carol");
    expect(html).toContain("Meetup");
  });

  it("has correct subject lines", () => {
    expect(emailTemplates.ticketIssued.subject).toContain("Registration Confirmed");
    expect(emailTemplates.checkInConfirmed.subject).toBe("Check-In Confirmed");
  });
});

describe("emailLogFilterSchema", () => {
  it("accepts empty filter", () => {
    const result = emailLogFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts email_type filter", () => {
    const result = emailLogFilterSchema.safeParse({ email_type: "ticket_issued" });
    expect(result.success).toBe(true);
  });

  it("accepts status filter", () => {
    const result = emailLogFilterSchema.safeParse({ status: "failed" });
    expect(result.success).toBe(true);
  });

  it("accepts user_id filter", () => {
    const result = emailLogFilterSchema.safeParse({ user_id: "1" });
    expect(result.success).toBe(true);
  });

  it("accepts date range filters", () => {
    const result = emailLogFilterSchema.safeParse({
      date_from: "2026-07-01",
      date_to: "2026-07-31",
    });
    expect(result.success).toBe(true);
  });

  it("accepts combined filters", () => {
    const result = emailLogFilterSchema.safeParse({
      email_type: "check_in_confirmed",
      status: "sent",
      user_id: "1",
      date_from: "2026-07-01",
      date_to: "2026-07-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email_type in filter", () => {
    const result = emailLogFilterSchema.safeParse({ email_type: "invalid" });
    expect(result.success).toBe(false);
  });
});
