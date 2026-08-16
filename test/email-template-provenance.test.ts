import { describe, it, expect } from "vitest";
import { emailTemplates, memberInvitedTemplate, passwordResetTemplate } from "@/shared/integrations/email/templates";

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
