import { escapeHtml, layout } from "./layout";

export interface PasswordResetParams {
  name: string;
  resetUrl: string;
}

/** Both halves of this message state the same reason, so they cannot drift. */
const RESET_REQUESTED = "You received this because a password reset was requested for this address.";

function passwordResetHtml(params: PasswordResetParams): string {
  return layout(
    "Reset your Startup Lab password",
    `      <h1 style="margin:0 0 16px;font-size:22px">Reset your password</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">We received a request to reset the password on your Startup Lab account. Use the button below to choose a new one.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#6b7280">${escapeHtml(params.resetUrl)}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">This link can only be used once and expires shortly. If you did not ask for it, you can ignore this message — your password will not change.</p>`,
    RESET_REQUESTED,
  );
}

function passwordResetText(params: PasswordResetParams): string {
  return [
    "Reset your password",
    "",
    `Hi ${params.name},`,
    "",
    "We received a request to reset the password on your Startup Lab account.",
    "",
    "Open this address to choose a new one:",
    params.resetUrl,
    "",
    "This link can only be used once and expires shortly. If you did not ask for it, you can ignore this message — your password will not change.",
    "",
    "--",
    "Startup Lab · startuplab.center",
    `${RESET_REQUESTED} This mailbox is unattended.`,
  ].join("\n");
}

export const passwordResetTemplate = {
  subject: "Reset your Startup Lab password",
  buildHtml: passwordResetHtml,
  buildText: passwordResetText,
} as const;
