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
    <title>${title}</title>
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
      <p style="margin:0 0 12px">Hi ${params.name},</p>
      <p style="margin:0 0 12px">You are registered for <strong>${params.eventTitle}</strong> on ${params.eventDate}.</p>
      <p style="margin:0 0 12px">Your payment has been confirmed and your ticket is ready. Present the QR code below at the event entrance to check in.</p>
      <p style="margin:0 0 12px">Keep this email — the code is your ticket. If it does not scan, staff can look you up by the name and email on this message.</p>
      ${params.qrDataUrl ? `<p style="margin:0"><img src="${params.qrDataUrl}" alt="Your check-in QR code" width="200" height="200" style="display:block;margin:24px auto" /></p>` : ""}`,
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
      <p style="margin:0 0 12px">Hi ${params.name},</p>
      <p style="margin:0 0 12px">You have been checked in for <strong>${params.eventTitle}</strong>.</p>
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
} as const;
