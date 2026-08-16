import { escapeHtml, layout, textFooter } from "./layout";

export interface EventSurveyParams {
  name: string;
  eventTitle: string;
  surveyUrl: string;
}

function eventSurveyHtml(params: EventSurveyParams): string {
  return layout(
    "Share your feedback",
    `      <h1 style="margin:0 0 16px;font-size:22px">How was ${escapeHtml(params.eventTitle)}?</h1>
      <p style="margin:0 0 12px">Hi ${escapeHtml(params.name)},</p>
      <p style="margin:0 0 12px">The event has wrapped up, and we would love to know what you thought. Rate it out of 5 stars and leave a comment — your feedback shapes future sessions.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(params.surveyUrl)}" style="display:inline-block;background:#1f2933;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Rate the event</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, copy this address into your browser:</p>
      <p style="margin:0;font-size:13px;word-break:break-all;color:#6b7280">${escapeHtml(params.surveyUrl)}</p>`,
  );
}

function eventSurveyText(params: EventSurveyParams): string {
  return [
    `How was ${params.eventTitle}?`,
    "",
    `Hi ${params.name},`,
    "",
    "The event has wrapped up, and we would love to know what you thought. Rate it out of 5 stars and leave a comment — your feedback shapes future sessions.",
    "",
    "Open this address to rate the event:",
    params.surveyUrl,
    "",
    ...textFooter(),
  ].join("\n");
}

export const eventSurveyTemplate = {
  subject: "How was the event? Share your feedback",
  buildHtml: eventSurveyHtml,
  buildText: eventSurveyText,
  // Sent to a list after the fact rather than in answer to anything the
  // recipient did, so declining further ones has to be possible.
  unsubscribable: true,
} as const;
