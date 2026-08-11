import { describe, it, expect } from "vitest";
import { emailLogFilterSchema } from "@/shared/integrations/email/log-filter-schema";
import { EMAIL_TYPES, EMAIL_STATUSES } from "@/shared/types";
import type { EmailLog, EmailType } from "@/shared/types";
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

  // The PG enum, the filter schema and the template registry drifted apart once
  // already, when 00019 added event_survey. These assert they still agree.
  it("the filter schema accepts every EmailType and rejects nothing else", () => {
    for (const email_type of EMAIL_TYPES) {
      expect(emailLogFilterSchema.safeParse({ email_type }).success).toBe(true);
    }
    expect(emailLogFilterSchema.safeParse({ email_type: "member_invited" }).success).toBe(false);
  });

  it("the filter schema accepts every EmailStatus", () => {
    for (const status of EMAIL_STATUSES) {
      expect(emailLogFilterSchema.safeParse({ status }).success).toBe(true);
    }
    expect(emailLogFilterSchema.safeParse({ status: "queued" }).success).toBe(false);
  });

  // memberInvited is deliberately absent from emailTemplates, so every logged
  // type having a template is the invariant worth pinning.
  it("every EmailType has a template that can build a message", () => {
    const byType: Record<EmailType, { subject: string }> = {
      ticket_issued: emailTemplates.ticketIssued,
      check_in_confirmed: emailTemplates.checkInConfirmed,
      event_survey: emailTemplates.eventSurvey,
    };

    for (const email_type of EMAIL_TYPES) {
      expect(byType[email_type].subject.length).toBeGreaterThan(0);
    }
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
    expect(emailTemplates.eventSurvey.subject).toContain("Share your feedback");
  });

  it("exports the event survey template with its link", () => {
    const html = emailTemplates.eventSurvey.buildHtml({
      name: "Ada",
      eventTitle: "Launch Day",
      surveyUrl: "https://startuplab.center/surveys/abc123",
    });

    expect(html).toContain("How was Launch Day?");
    expect(html).toContain("Hi Ada,");
    expect(html).toContain("https://startuplab.center/surveys/abc123");
  });

  it("builds survey text that stands alone", () => {
    const text = emailTemplates.eventSurvey.buildText({
      name: "Ada",
      eventTitle: "Launch Day",
      surveyUrl: "https://startuplab.center/surveys/abc123",
    });

    expect(text).toContain("Hi Ada,");
    expect(text).toContain("Open this address to rate the event:");
    expect(text).toContain("https://startuplab.center/surveys/abc123");
    expect(text).not.toContain("<");
  });

  // The survey token is random, but the recipient name and event title are not.
  it("escapes survey values the HTML part interpolates", () => {
    const html = emailTemplates.eventSurvey.buildHtml({
      name: '<img src=x onerror="alert(1)">',
      eventTitle: "<script>alert(1)</script>",
      surveyUrl: 'https://startuplab.center/surveys/abc" onclick="x',
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot; onclick=&quot;x");
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
