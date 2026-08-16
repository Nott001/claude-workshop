import { escapeHtml, layout, textFooter } from "./layout";

export interface TicketIssuedParams {
  name: string;
  eventTitle: string;
  eventDate: string;
  qrDataUrl?: string;
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
    ...textFooter(),
  ].join("\n");
}

export const ticketIssuedTemplate = {
  // A Subject header is not HTML: an entity here reaches the inbox literally.
  subject: "Registration Confirmed — Your Ticket Is Ready",
  buildHtml: ticketIssuedHtml,
  buildText: ticketIssuedText,
} as const;
