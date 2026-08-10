import type { DbClient } from "@/shared/db/dao/types";
import { throwOnDbError } from "@/shared/db/dao/helpers";
import type { Survey, SurveyResponse, Event, User } from "@/shared/types";

export interface SurveyWithEvent extends Survey {
  EVENT: Pick<Event, "title"> | null;
}

export interface SurveyResponseWithAttendee extends SurveyResponse {
  USER: Pick<User, "full_name" | "email"> | null;
}

export interface SurveyRecipient {
  user_id: number;
  full_name: string;
  email: string;
}

export async function findSurveyByEventId(supabase: DbClient, eventId: number): Promise<Survey | null> {
  const { data, error } = await supabase.from("SURVEY").select("*").eq("event_id", eventId).maybeSingle();
  throwOnDbError(error, "survey.dao.findSurveyByEventId");
  return data;
}

export async function createSurvey(supabase: DbClient, eventId: number, sentAt: string): Promise<Survey> {
  const { data, error } = await supabase.from("SURVEY").insert({ event_id: eventId, sent_at: sentAt }).select("*").single();
  throwOnDbError(error, "survey.dao.createSurvey");
  return data;
}

export async function createResponses(
  supabase: DbClient,
  surveyId: number,
  recipients: { user_id: number; token: string }[],
): Promise<SurveyResponse[]> {
  if (recipients.length === 0) return [];
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .insert(recipients.map((recipient) => ({ survey_id: surveyId, user_id: recipient.user_id, token: recipient.token })))
    .select("*");
  throwOnDbError(error, "survey.dao.createResponses");
  return data ?? [];
}

export async function findRecipients(supabase: DbClient, eventId: number): Promise<SurveyRecipient[]> {
  // Same ticket rule the attendee count uses: every non-cancelled holder. One
  // active ticket per user per event, so a user_id appears once; dedupe anyway
  // so a stray duplicate cannot produce two response rows for one attendee.
  const { data, error } = await supabase
    .from("TICKET")
    .select("user_id, USER:user_id!inner(full_name, email)")
    .eq("event_id", eventId)
    .neq("status", "cancelled");
  throwOnDbError(error, "survey.dao.findRecipients");
  const seen = new Set<number>();
  return (data ?? []).flatMap(
    (row: {
      user_id: number;
      USER: Pick<SurveyRecipient, "full_name" | "email"> | Pick<SurveyRecipient, "full_name" | "email">[];
    }) => {
      const user = Array.isArray(row.USER) ? row.USER[0] : row.USER;
      if (!user || seen.has(row.user_id)) return [];
      seen.add(row.user_id);
      return [{ user_id: row.user_id, full_name: user.full_name, email: user.email }];
    },
  );
}

export async function findResponsesNeedingSend(supabase: DbClient, surveyIds: number[]): Promise<SurveyResponseWithAttendee[]> {
  if (surveyIds.length === 0) return [];
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .select("*, USER:user_id(full_name, email)")
    .in("survey_id", surveyIds)
    .is("sent_at", null)
    .is("submitted_at", null);
  throwOnDbError(error, "survey.dao.findResponsesNeedingSend");
  return (data ?? []).map((row) => ({
    ...row,
    USER: Array.isArray(row.USER) ? (row.USER[0] ?? null) : row.USER,
  }));
}

export async function markResponseSent(supabase: DbClient, responseId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .update({ sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", responseId)
    .select("id");
  if (error) {
    throwOnDbError(error, "survey.dao.markResponseSent");
  }
  return (data?.length ?? 0) > 0;
}

export async function findByToken(
  supabase: DbClient,
  token: string,
): Promise<(SurveyResponseWithAttendee & { SURVEY: SurveyWithEvent }) | null> {
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .select("*, SURVEY(event_id, sent_at, EVENT(title))")
    .eq("token", token)
    .maybeSingle();
  throwOnDbError(error, "survey.dao.findByToken");
  return data ?? null;
}

export async function markSubmitted(
  supabase: DbClient,
  responseId: number,
  rating: number,
  comment: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .update({
      rating,
      comment,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", responseId)
    .select("id");
  if (error) {
    throwOnDbError(error, "survey.dao.markSubmitted");
  }
  return (data?.length ?? 0) > 0;
}

export async function findSubmittedResponses(supabase: DbClient, surveyId: number): Promise<SurveyResponseWithAttendee[]> {
  const { data, error } = await supabase
    .from("SURVEY_RESPONSE")
    .select("*, USER:user_id(full_name)")
    .eq("survey_id", surveyId)
    .not("submitted_at", "is", null);
  throwOnDbError(error, "survey.dao.findSubmittedResponses");
  return (data ?? []).map((row) => ({
    ...row,
    USER: Array.isArray(row.USER) ? (row.USER[0] ?? null) : row.USER,
  }));
}

export async function countResponses(supabase: DbClient, surveyId: number): Promise<number> {
  const { count } = await supabase
    .from("SURVEY_RESPONSE")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);
  return count ?? 0;
}
