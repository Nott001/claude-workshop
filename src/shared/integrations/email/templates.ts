function ticketIssuedHtml(params: { name: string; eventTitle: string; eventDate: string; qrDataUrl?: string }): string {
  return `
    <h1>Registration Confirmed &mdash; Ticket Issued</h1>
    <p>Hi ${params.name},</p>
    <p>You are registered for <strong>${params.eventTitle}</strong> on ${params.eventDate}.</p>
    <p>Your payment has been confirmed and your ticket is ready. Present the QR code below at the event to check in.</p>
    ${params.qrDataUrl ? `<p><img src="${params.qrDataUrl}" alt="QR code" width="200" height="200" style="display:block;margin:24px auto" /></p>` : ""}
  `;
}

function checkInConfirmedHtml(params: { name: string; eventTitle: string }): string {
  return `
    <h1>Check-In Confirmed</h1>
    <p>Hi ${params.name},</p>
    <p>You have been checked in for <strong>${params.eventTitle}</strong>.</p>
    <p>Enjoy the event!</p>
  `;
}

export const emailTemplates = {
  ticketIssued: {
    subject: "Registration Confirmed &mdash; Your Ticket Is Ready",
    buildHtml: ticketIssuedHtml,
  },
  checkInConfirmed: {
    subject: "Check-In Confirmed",
    buildHtml: checkInConfirmedHtml,
  },
} as const;
