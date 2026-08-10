import crypto from "node:crypto";
import { z } from "zod";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, SurveyResponse } from "@/shared/types";
import { isEventFinished } from "@/shared/lib/date-utils";
import { appBaseUrl } from "@/shared/lib/app-url";
import { sendEmailNotification } from "@/modules/notifications/lib/email";
import * as surveyDao from "@/modules/surveys/db/survey.dao";
import type { SurveyResponseWithAttendee } from "@/modules/surveys/db/survey.dao";

export const SURVEY_WINDOW_DAYS = 14;

const WINDOW_MS = SURVEY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function isWithinWindow(sentAt: string): boolean {
  return new Date(sentAt).getTime() >= Date.now() - WINDOW_MS;
}

function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export type SendSurveyResult =
  | { ok: true; survey_created: boolean; recipients: number; delivered: number; failed: number }
  | { ok: false; reason: "not_enabled" | "not_finished" | "no_recipients" | "expired" };

/** Staff-triggered send. Creates the survey and its response rows, then emails
 * every recipient. Re-running after a partial failure retries only the
 * responses never delivered, so the same call covers both first send and retry. */
export async function sendEventSurvey(supabase: DbClient, event: Event, now = new Date()): Promise<SendSurveyResult> {
  if (!event.survey_enabled) return { ok: false, reason: "not_enabled" };
  if (!isEventFinished(event.event_date, event.end_time)) return { ok: false, reason: "not_finished" };

  const existing = await surveyDao.findSurveyByEventId(supabase, event.id);
  if (existing && !isWithinWindow(existing.sent_at)) return { ok: false, reason: "expired" };

  const recipients = await surveyDao.findRecipients(supabase, event.id);
  if (recipients.length === 0) return { ok: false, reason: "no_recipients" };

  const byUserId = new Map(recipients.map((recipient) => [recipient.user_id, recipient]));

  const survey = existing ?? (await surveyDao.createSurvey(supabase, event.id, now.toISOString()));
  const responses: SurveyResponseWithAttendee[] = existing
    ? await surveyDao.findResponsesNeedingSend(supabase, [survey.id])
    : ((await surveyDao.createResponses(
        supabase,
        survey.id,
        recipients.map((recipient) => ({ user_id: recipient.user_id, token: newToken() })),
      )) as SurveyResponseWithAttendee[]);

  let delivered = 0;
  for (const response of responses) {
    const recipient = byUserId.get(response.user_id) ?? {
      full_name: response.USER?.full_name ?? "",
      email: response.USER?.email ?? "",
    };
    if (await deliver(supabase, event.title, response, recipient)) delivered += 1;
  }

  return {
    ok: true,
    survey_created: !existing,
    recipients: responses.length,
    delivered,
    failed: responses.length - delivered,
  };
}

async function deliver(
  supabase: DbClient,
  eventTitle: string,
  response: SurveyResponse,
  recipient: { full_name: string; email: string },
): Promise<boolean> {
  try {
    const delivered = await sendEmailNotification({
      user_id: response.user_id,
      email: recipient.email,
      name: recipient.full_name,
      email_type: "event_survey",
      eventTitle,
      surveyUrl: `${appBaseUrl()}/surveys/${response.token}`,
    });
    if (delivered) {
      await surveyDao.markResponseSent(supabase, response.id);
    }
    return delivered;
  } catch (err) {
    console.error("survey email failed for response", response.id, err);
    return false;
  }
}

export type SurveyTokenState = { state: "open"; event_title: string } | { state: "submitted" } | { state: "expired" };

export async function getSurveyByToken(supabase: DbClient, token: string): Promise<SurveyTokenState | null> {
  const response = await surveyDao.findByToken(supabase, token);
  if (!response) return null;
  if (response.submitted_at) return { state: "submitted" };
  if (!isWithinWindow(response.SURVEY.sent_at)) return { state: "expired" };
  return { state: "open", event_title: response.SURVEY.EVENT?.title ?? "this event" };
}

const submissionSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export type SubmitSurveyResult =
  { ok: true } | { ok: false; reason: "not_found" | "already_submitted" | "expired" | "invalid" };

export async function submitSurvey(
  supabase: DbClient,
  token: string,
  input: { rating: unknown; comment: unknown },
): Promise<SubmitSurveyResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const response = await surveyDao.findByToken(supabase, token);
  if (!response) return { ok: false, reason: "not_found" };
  if (response.submitted_at) return { ok: false, reason: "already_submitted" };
  if (!isWithinWindow(response.SURVEY.sent_at)) return { ok: false, reason: "expired" };

  const comment = parsed.data.comment?.trim() ? parsed.data.comment.trim() : null;
  await surveyDao.markSubmitted(supabase, response.id, parsed.data.rating, comment);
  return { ok: true };
}

export interface SurveyResults {
  average: number | null;
  counts: [number, number, number, number, number];
  comments: { rating: number | null; comment: string | null; attendee_name: string | null }[];
}

export async function getSurveyResults(supabase: DbClient, surveyId: number): Promise<SurveyResults> {
  const responses = await surveyDao.findSubmittedResponses(supabase, surveyId);

  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const comments: SurveyResults["comments"] = [];
  let rated = 0;
  let total = 0;

  for (const response of responses) {
    if (response.rating != null) {
      total += response.rating;
      rated += 1;
      counts[response.rating - 1] += 1;
    }
    if (response.comment) {
      comments.push({
        rating: response.rating,
        comment: response.comment,
        attendee_name: response.USER?.full_name ?? null,
      });
    }
  }

  const average = rated > 0 ? Math.round((total / rated) * 10) / 10 : null;
  return { average, counts, comments };
}

export interface StaffSurveyStatus {
  event_title: string;
  survey_enabled: boolean;
  survey: {
    sent_at: string;
    total_recipients: number;
    responded_count: number;
    undelivered_count: number;
    expired: boolean;
  } | null;
  results: SurveyResults;
}

export async function getStaffSurveyStatus(supabase: DbClient, event: Event): Promise<StaffSurveyStatus> {
  const survey = await surveyDao.findSurveyByEventId(supabase, event.id);
  const results = survey ? await getSurveyResults(supabase, survey.id) : emptyResults();
  return {
    event_title: event.title,
    survey_enabled: event.survey_enabled,
    survey: survey
      ? {
          sent_at: survey.sent_at,
          total_recipients: await surveyDao.countResponses(supabase, survey.id),
          responded_count: results.counts.reduce((sum, count) => sum + count, 0),
          undelivered_count: (await surveyDao.findResponsesNeedingSend(supabase, [survey.id])).length,
          expired: !isWithinWindow(survey.sent_at),
        }
      : null,
    results,
  };
}

function emptyResults(): SurveyResults {
  return { average: null, counts: [0, 0, 0, 0, 0], comments: [] };
}
