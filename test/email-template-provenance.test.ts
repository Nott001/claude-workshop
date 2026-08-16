import { describe, it, expect } from "vitest";
import { emailTemplates, memberInvitedTemplate, passwordResetTemplate } from "@/shared/integrations/email/templates";
import { BRAND, BRAND_FULL, MAIL_DOMAIN } from "@/shared/integrations/email/brand";

// The invite and reset templates sit outside `emailTemplates` on purpose:
// neither recipient is guaranteed a USER row for EMAIL_LOG to reference.
const allTemplates = {
  ...emailTemplates,
  memberInvited: memberInvitedTemplate,
  passwordReset: passwordResetTemplate,
};

/**
 * Every message says why it arrived, and the HTML and text halves have to agree
 * on the answer. They did not: each text half carried a reason of its own while
 * the shared layout hardcoded "you registered for an event" into all five, so a
 * password reset and an invitation both told the reader they had registered for
 * something. The invitation reaches someone with no account at all.
 *
 * Beyond being untrue, the two halves of one message contradicting each other
 * is the kind of inconsistency filters are built to notice.
 */
const cases = [
  {
    name: "ticketIssued",
    params: { name: "Ada", eventTitle: "Launch", eventDate: "2026-09-01" },
    reason: /registered for an event/,
  },
  { name: "checkInConfirmed", params: { name: "Ada", eventTitle: "Launch" }, reason: /registered for an event/ },
  {
    name: "eventSurvey",
    params: { name: "Ada", eventTitle: "Launch", surveyUrl: "https://x.test/s/1" },
    reason: /registered for an event/,
  },
  {
    name: "memberInvited",
    params: { name: "Ada", role: "admin", acceptUrl: "https://x.test/invite?token=t" },
    reason: /administrator invited you/,
  },
  {
    name: "passwordReset",
    params: { name: "Ada", resetUrl: "https://x.test/reset?token=t" },
    reason: /password reset was requested/,
  },
] as const;

describe("every template states the same reason in both halves", () => {
  for (const { name, params, reason } of cases) {
    it(`${name} agrees with itself about why the mail arrived`, () => {
      const template = (
        allTemplates as Record<string, { buildHtml: (p: unknown) => string; buildText: (p: unknown) => string }>
      )[name];
      const html = template.buildHtml(params);
      const text = template.buildText(params);

      expect(html).toMatch(reason);
      expect(text).toMatch(reason);
    });
  }

  it("does not tell an invitee or a reset request that they registered for an event", () => {
    const invite = memberInvitedTemplate;
    const reset = passwordResetTemplate;

    expect(invite.buildHtml({ name: "Ada", role: "admin", acceptUrl: "https://x.test/i" })).not.toMatch(
      /registered for an event/,
    );
    expect(reset.buildHtml({ name: "Ada", resetUrl: "https://x.test/r" })).not.toMatch(/registered for an event/);
  });
});

/**
 * Which messages may offer an unsubscribe is a property of the message, not of
 * configuration, so it is asserted against the templates themselves.
 */
describe("unsubscribe eligibility", () => {
  it("offers one only on the messages nobody asked for", () => {
    expect(memberInvitedTemplate.unsubscribable).toBe(true);
    expect(emailTemplates.eventSurvey.unsubscribable).toBe(true);
  });

  it("never offers one on mail the recipient requested", () => {
    expect(emailTemplates.ticketIssued).not.toHaveProperty("unsubscribable");
    expect(emailTemplates.checkInConfirmed).not.toHaveProperty("unsubscribable");
    expect(passwordResetTemplate).not.toHaveProperty("unsubscribable");
  });
});

/**
 * The wordmark is one string in one module. It had been written out by hand in
 * six template files and the SMTP config, which is how the mail came to call
 * itself "Startup Lab" while every other surface said "StartupLab".
 */
describe("sender naming", () => {
  for (const { name, params } of cases) {
    it(`${name} writes the wordmark as one word`, () => {
      const template = (
        allTemplates as Record<
          string,
          { subject: string; buildHtml: (p: unknown) => string; buildText: (p: unknown) => string }
        >
      )[name];

      const rendered = [template.subject, template.buildHtml(params), template.buildText(params)].join("\n");

      expect(rendered).not.toMatch(/Startup Lab/);
      expect(rendered).toContain(BRAND);
    });
  }

  it("signs the footer with the full name beside the sending domain", () => {
    const text = memberInvitedTemplate.buildText({ name: "Ada", role: "admin", acceptUrl: "https://x.test/i" });

    expect(text).toContain(`${BRAND_FULL} · ${MAIL_DOMAIN}`);
  });
});
