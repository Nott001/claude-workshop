import { escapeHtml, layout } from "./layout";

export interface CheckInConfirmedParams {
  name: string;
  eventTitle: string;
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

export const checkInConfirmedTemplate = {
  subject: "Check-In Confirmed",
  buildHtml: checkInConfirmedHtml,
  buildText: checkInConfirmedText,
} as const;
