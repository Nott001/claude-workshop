import { describe, it, expect } from "vitest";
import { emailLogFilterSchema } from "@/modules/notifications/lib/email-log-schema";
import type { EmailLog, EmailType, EmailStatus } from "@/shared/types";
import { emailTemplates } from "@/shared/integrations/email/templates";

describe("Email types", () => {
  it("EmailLog interface has correct shape", () => {
    const log: EmailLog = {
      id: 1,
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

  it("emits a complete HTML document, not a fragment", () => {
    // Filters score a bare run of <h1>/<p> worse than a real document.
    const html = emailTemplates.ticketIssued.buildHtml({ name: "Bob", eventTitle: "Conference", eventDate: "2026-08-15" });

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain("<title>Registration Confirmed</title>");
    expect(html).toContain("</html>");
  });

  it("says who sent it and why it arrived", () => {
    const html = emailTemplates.checkInConfirmed.buildHtml({ name: "Carol", eventTitle: "Meetup" });

    expect(html).toContain("startuplab.center");
    expect(html).toContain("You received this because you registered");
  });

  it("builds a plain-text part that stands on its own", () => {
    const text = emailTemplates.ticketIssued.buildText({ name: "Bob", eventTitle: "Conference", eventDate: "2026-08-15" });

    expect(text).toContain("Registration Confirmed");
    expect(text).toContain("Hi Bob,");
    expect(text).toContain("Conference");
    expect(text).toContain("2026-08-15");
    expect(text).toContain("startuplab.center");
    expect(text).not.toContain("<");
  });

  it("builds check-in text without leaving the reader mid-sentence", () => {
    const text = emailTemplates.checkInConfirmed.buildText({ name: "Carol", eventTitle: "Meetup" });

    expect(text).toContain("Check-In Confirmed");
    expect(text).toContain("Carol");
    expect(text).toContain("Meetup");
    expect(text).not.toContain("<");
  });

  it("has correct subject lines", () => {
    expect(emailTemplates.ticketIssued.subject).toContain("Registration Confirmed");
    expect(emailTemplates.checkInConfirmed.subject).toBe("Check-In Confirmed");
  });

  // An event title is written by whoever created the event and then mailed to
  // every attendee who registers, so it carries one user's input into other
  // people's inboxes.
  it("escapes markup in the values the HTML part interpolates", () => {
    const html = emailTemplates.ticketIssued.buildHtml({
      name: '<img src=x onerror="alert(1)">',
      eventTitle: "<script>alert(1)</script>",
      eventDate: "2026-08-15",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes a title that would otherwise close its attribute", () => {
    const html = emailTemplates.checkInConfirmed.buildHtml({
      name: "Carol",
      eventTitle: '" onmouseover="alert(1)',
    });

    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
  });

  it("escapes ampersands once, not twice", () => {
    const html = emailTemplates.checkInConfirmed.buildHtml({
      name: "Carol",
      eventTitle: "Design & Build",
    });

    expect(html).toContain("Design &amp; Build");
    expect(html).not.toContain("&amp;amp;");
  });

  // Nothing parses the text half as markup, and an entity there reaches the
  // reader literally.
  it("leaves the plain-text part unescaped", () => {
    const text = emailTemplates.checkInConfirmed.buildText({
      name: "Carol",
      eventTitle: "Design & Build",
    });

    expect(text).toContain("Design & Build");
    expect(text).not.toContain("&amp;");
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
