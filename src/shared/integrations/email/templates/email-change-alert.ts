import { escapeHtml, layout } from "./layout";

export interface EmailChangeAlertParams {
  name: string;
  newEmail: string;
}

function emailChangeAlertHtml(params: EmailChangeAlertParams): string {
  return layout(
    "Your email is changing",
    `      <h1 style="margin:0 0 16px;font-size:22px">Your email is changing</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">We received a request to change the email on your Startup Lab account to <strong>${escapeHtml(params.newEmail)}</strong>.</p>
      <p style="margin:0">If you did not request this, contact our team immediately.</p>`,
  );
}

function emailChangeAlertText(params: EmailChangeAlertParams): string {
  return [
    "Your email is changing",
    "",
    `Hi ${params.name},`,
    "",
    `We received a request to change the email on your Startup Lab account to ${params.newEmail}.`,
    "",
    "If you did not request this, contact our team immediately.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    "You received this because an email change was requested for this address. This mailbox is unattended.",
  ].join("\n");
}

export const emailChangeAlertTemplate = {
  subject: "Your email is changing",
  buildHtml: emailChangeAlertHtml,
  buildText: emailChangeAlertText,
} as const;
