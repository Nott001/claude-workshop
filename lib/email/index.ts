import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getFromAddress(): string | null {
  return process.env.RESEND_FROM_ADDRESS ?? null;
}

interface SendEmailParams {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
}

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

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean }> {
  const fromAddress = getFromAddress();
  if (!fromAddress) {
    console.warn("RESEND_FROM_ADDRESS not set; skipping email send");
    return { success: false };
  }

  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY not set; skipping email send");
    return { success: false };
  }

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [params.to.email],
    subject: params.subject,
    html: params.htmlContent,
  });

  if (error) {
    console.warn("Resend send failed:", error.message);
    return { success: false };
  }

  return { success: true };
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
};
