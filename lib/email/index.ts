const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendEmailParams {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
}

function registrationConfirmationHtml(params: { name: string; eventTitle: string; eventDate: string }): string {
  return `
    <h1>Registration Confirmed</h1>
    <p>Hi ${params.name},</p>
    <p>You have registered for <strong>${params.eventTitle}</strong> on ${params.eventDate}.</p>
    <p>Your payment is being processed. You will receive your ticket once payment is confirmed.</p>
  `;
}

function ticketIssuedHtml(params: { name: string; eventTitle: string; eventDate: string }): string {
  return `
    <h1>Ticket Issued</h1>
    <p>Hi ${params.name},</p>
    <p>Your ticket for <strong>${params.eventTitle}</strong> on ${params.eventDate} has been issued.</p>
    <p>Present your QR code at the event to check in.</p>
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
  if (!BREVO_API_KEY) {
    console.warn("BREVO_API_KEY not set; skipping email send");
    return { success: false };
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Event Platform", email: "noreply@example.com" },
        to: [params.to],
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("Brevo send failed:", res.status, text);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.warn("Brevo send error:", err);
    return { success: false };
  }
}

export const emailTemplates = {
  registrationConfirmation: {
    subject: "Registration Confirmed",
    buildHtml: registrationConfirmationHtml,
  },
  ticketIssued: {
    subject: "Your Ticket Has Been Issued",
    buildHtml: ticketIssuedHtml,
  },
  checkInConfirmed: {
    subject: "Check-In Confirmed",
    buildHtml: checkInConfirmedHtml,
  },
};
