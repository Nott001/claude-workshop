/**
 * Values interpolated into the HTML half of a message are user-controlled — a
 * member's name, an event title someone else typed — and the message reaches
 * inboxes other than the author's. Unescaped, a title carrying markup renders
 * as markup inside mail that otherwise passes SPF and DKIM, which is the part
 * that makes it worth injecting into.
 *
 * Escaping happens per value at the interpolation site rather than as a pass
 * over the finished document, so the markup the templates own stays intact.
 * `&` goes first; reversing that order would double-escape the entities the
 * later replacements introduce.
 *
 * The text halves below are deliberately left alone: nothing parses them as
 * markup, and an `&amp;` in a text/plain body reaches the reader literally.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A bare fragment of `<h1>`/`<p>` scores worse with spam filters than a
 * complete document, so every message is wrapped in one: doctype, charset,
 * a title, and a footer saying who sent it and why it arrived.
 */
function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
${body}
    </div>
    <div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6b7280;text-align:center">
      <p style="margin:0">Startup Lab &middot; startuplab.center</p>
      <p style="margin:4px 0 0">
        You received this because you registered for an event at Startup Lab.
        This mailbox is unattended.
      </p>
    </div>
  </body>
</html>`;
}

interface TicketIssuedParams {
  name: string;
  eventTitle: string;
  eventDate: string;
  qrDataUrl?: string;
}

interface CheckInConfirmedParams {
  name: string;
  eventTitle: string;
}

function ticketIssuedHtml(params: TicketIssuedParams): string {
  return layout(
    "Registration Confirmed",
    `      <h1 style="margin:0 0 16px;font-size:22px">Registration Confirmed — Ticket Issued</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">You are registered for <strong>${escapeHtml(params.eventTitle)}</strong> on ${escapeHtml(params.eventDate)}.</p>
      <p style="margin:0 0 12px">Your payment has been confirmed and your ticket is ready. Present the QR code below at the event entrance to check in.</p>
      <p style="margin:0 0 12px">Keep this email — the code is your ticket. If it does not scan, staff can look you up by the name and email on this message.</p>
      ${params.qrDataUrl ? `<p style="margin:0"><img src="${escapeHtml(params.qrDataUrl)}" alt="Your check-in QR code" width="200" height="200" style="display:block;margin:24px auto" /></p>` : ""}`,
  );
}

/**
 * Written rather than derived from the HTML: a stripped-down copy reads as
 * truncated, and this half is what plain-text clients and filters actually see.
 */
function ticketIssuedText(params: TicketIssuedParams): string {
  return [
    "Registration Confirmed — Ticket Issued",
    "",
    `Hi ${params.name},`,
    "",
    `You are registered for ${params.eventTitle} on ${params.eventDate}.`,
    "",
    "Your payment has been confirmed and your ticket is ready. Present the QR code in this email at the event entrance to check in.",
    "",
    "Keep this email — the code is your ticket. If it does not scan, staff can look you up by the name and email on this message.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because you registered for an event at Startup Lab. This mailbox is unattended.",
  ].join("\n");
}

function checkInConfirmedHtml(params: CheckInConfirmedParams): string {
  return layout(
    "Check-In Confirmed",
    `      <h1 style="margin:0 0 16px;font-size:22px">Check-In Confirmed</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">You have been checked in for <strong>${escapeHtml(params.eventTitle)}</strong>.</p>
      <p style="margin:0">Enjoy the event. No further action is needed — this message is your record of arrival.</p>`,
  );
}

function checkInConfirmedText(params: CheckInConfirmedParams): string {
  return [
    "Check-In Confirmed",
    "",
    `Hi ${params.name},`,
    "",
    `You have been checked in for ${params.eventTitle}.`,
    "",
    "Enjoy the event. No further action is needed — this message is your record of arrival.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because you registered for an event at Startup Lab. This mailbox is unattended.",
  ].join("\n");
}

interface EventSurveyParams {
  name: string;
  eventTitle: string;
  surveyUrl: string;
}

function eventSurveyHtml(params: EventSurveyParams): string {
  return layout(
    "Share your feedback",
    `      <h1 style="margin:0 0 16px;font-size:22px">How was ${escapeHtml(params.eventTitle)}?</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">The event has wrapped up, and we would love to know what you thought. Rate it out of 5 stars and leave a comment — your feedback shapes future sessions.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(params.surveyUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Rate the event</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:</p>
      <p style="margin:0;font-size:13px;word-break:break-all;color:#6b7280">${escapeHtml(params.surveyUrl)}</p>`,
  );
}

function eventSurveyText(params: EventSurveyParams): string {
  return [
    `How was ${params.eventTitle}?`,
    "",
    `Hi ${params.name},`,
    "",
    "The event has wrapped up, and we would love to know what you thought. Rate it out of 5 stars and leave a comment — your feedback shapes future sessions.",
    "",
    "Open this address to rate the event:",
    params.surveyUrl,
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because you registered for an event at Startup Lab. This mailbox is unattended.",
  ].join("\n");
}

interface MemberInvitedParams {
  name: string;
  role: string;
  acceptUrl: string;
}

function memberInvitedHtml(params: MemberInvitedParams): string {
  return layout(
    "You have been invited to Startup Lab",
    `      <h1 style="margin:0 0 16px;font-size:22px">You have been invited to Startup Lab</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">An administrator has invited you to join the Startup Lab team as a <strong>${escapeHtml(params.role)}</strong>. Accepting creates your account and gives you access to the events and course material for that role.</p>
      <p style="margin:0 0 24px">Use the button below to set your password and finish signing in.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(params.acceptUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Accept the invitation</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#6b7280">${escapeHtml(params.acceptUrl)}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">This invitation can only be used once. If you were not expecting it, you can ignore this message.</p>`,
  );
}

function memberInvitedText(params: MemberInvitedParams): string {
  return [
    "You have been invited to Startup Lab",
    "",
    `Hi ${params.name},`,
    "",
    `An administrator has invited you to join the Startup Lab team as a ${params.role}. Accepting creates your account and gives you access to the events and course material for that role.`,
    "",
    "Open this address to set your password and finish signing in:",
    params.acceptUrl,
    "",
    "This invitation can only be used once. If you were not expecting it, you can ignore this message.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because an administrator invited you to the Startup Lab team. This mailbox is unattended.",
  ].join("\n");
}

/**
 * Kept out of `emailTemplates`, which is keyed by the `email_type` enum and so
 * describes messages that get an EMAIL_LOG row. An invitee has no USER row for
 * that table to reference, and the audit log already records the invitation.
 */
export const memberInvitedTemplate = {
  subject: "You have been invited to Startup Lab",
  buildHtml: memberInvitedHtml,
  buildText: memberInvitedText,
} as const;

export const emailTemplates = {
  ticketIssued: {
    // A Subject header is not HTML: an entity here reaches the inbox literally.
    subject: "Registration Confirmed — Your Ticket Is Ready",
    buildHtml: ticketIssuedHtml,
    buildText: ticketIssuedText,
  },
  checkInConfirmed: {
    subject: "Check-In Confirmed",
    buildHtml: checkInConfirmedHtml,
    buildText: checkInConfirmedText,
  },
  eventSurvey: {
    subject: "How was the event? Share your feedback",
    buildHtml: eventSurveyHtml,
    buildText: eventSurveyText,
  },
} as const;

/** Every template's params intersected: a message carries a superset object,
 * and whichever template is picked must be satisfied by it. */
export type EmailTemplateParams = TicketIssuedParams & CheckInConfirmedParams & EventSurveyParams;
