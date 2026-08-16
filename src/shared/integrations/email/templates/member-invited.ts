import { BRAND, escapeHtml, layout, textFooter } from "./layout";

export interface MemberInvitedParams {
  name: string;
  role: string;
  acceptUrl: string;
}

/** Both halves of this message state the same reason, so they cannot drift. */
const ADMIN_INVITED = `You received this because an administrator invited you to the ${BRAND} team.`;

function memberInvitedHtml(params: MemberInvitedParams): string {
  return layout(
    `You have been invited to ${BRAND}`,
    `      <h1 style="margin:0 0 16px;font-size:22px">You have been invited to ${BRAND}</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">An administrator has invited you to join the ${BRAND} team as a <strong>${escapeHtml(params.role)}</strong>. Accepting creates your account and gives you access to the events and course material for that role.</p>
      <p style="margin:0 0 24px">Use the button below to set your password and finish signing in.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(params.acceptUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Accept the invitation</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#6b7280">${escapeHtml(params.acceptUrl)}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">This invitation can only be used once. If you were not expecting it, you can ignore this message.</p>`,
    ADMIN_INVITED,
  );
}

function memberInvitedText(params: MemberInvitedParams): string {
  return [
    `You have been invited to ${BRAND}`,
    "",
    `Hi ${params.name},`,
    "",
    `An administrator has invited you to join the ${BRAND} team as a ${params.role}. Accepting creates your account and gives you access to the events and course material for that role.`,
    "",
    "Open this address to set your password and finish signing in:",
    params.acceptUrl,
    "",
    "This invitation can only be used once. If you were not expecting it, you can ignore this message.",
    "",
    ...textFooter(ADMIN_INVITED),
  ].join("\n");
}

export const memberInvitedTemplate = {
  subject: `You have been invited to ${BRAND}`,
  buildHtml: memberInvitedHtml,
  buildText: memberInvitedText,
  // Reaches somebody who never asked for it, which is the case the header is
  // for -- and this is the message filters are actually flagging.
  unsubscribable: true,
} as const;
