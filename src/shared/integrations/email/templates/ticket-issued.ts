import { escapeHtml, layout } from "./layout";

export interface TicketIssuedParams {
  name: string;
  eventTitle: string;
  eventDate: string;
  code: string;
  qrDataUrl?: string;
}

function ticketIssuedHtml(params: TicketIssuedParams): string {
  return layout(
    "Registration Confirmed",
    `      <h1 style="margin:0 0 16px;font-size:22px">Registration Confirmed — Ticket Issued</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">You are registered for <strong>${escapeHtml(params.eventTitle)}</strong> on ${escapeHtml(params.eventDate)}.</p>
      <p style="margin:0 0 12px">Your payment has been confirmed and your ticket is ready.</p>
      <p style="margin:0 0 12px">Your check-in code: <strong style="font-family:monospace;letter-spacing:2px">${escapeHtml(params.code)}</strong></p>
      <p style="margin:0 0 12px">Present the QR code below at the event entrance to check in, or type your check-in code into the kiosk. Keep this email — the QR and the code are your ticket.</p>
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
    "Your payment has been confirmed and your ticket is ready.",
    "",
    `Your check-in code: ${params.code}`,
    "",
    "Present the QR code in this email at the entrance to check in, or type your check-in code into the kiosk. Keep this email — the QR and the code are your ticket.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because you registered for an event at Startup Lab. This mailbox is unattended.",
  ].join("\n");
}

export const ticketIssuedTemplate = {
  // A Subject header is not HTML: an entity here reaches the inbox literally.
  subject: "Registration Confirmed — Your Ticket Is Ready",
  buildHtml: ticketIssuedHtml,
  buildText: ticketIssuedText,
} as const;
