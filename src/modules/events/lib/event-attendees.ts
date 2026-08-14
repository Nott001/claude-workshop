import type { DbClient } from "@/shared/db/dao/types";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { isEventFinished } from "@/shared/lib/date-utils";
import { getAttendeeSurveyFlags } from "@/modules/surveys/lib/survey-service";
import type { Event } from "@/shared/types";

export interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

export async function listEventAttendees(
  supabase: DbClient,
  eventId: number,
  options: { search: string; status: string; page: number; limit: number },
): Promise<{ attendees: AttendeeRow[]; total: number; page: number; limit: number }> {
  const { search, status, page, limit } = options;

  const { data: rawAttendees, total } = await ticketDao.getAttendees(supabase, eventId, {
    search,
    status,
    page,
    limit,
  });

  const attendees: AttendeeRow[] = (
    (rawAttendees ?? []) as {
      USER: { id: number; full_name: string; email: string } | null;
      status: string;
      issued_at: string;
      updated_at: string;
    }[]
  ).map((row) => ({
    user_id: row.USER?.id ?? 0,
    full_name: row.USER?.full_name ?? "Unknown",
    email: row.USER?.email ?? "",
    ticket_status: row.status as AttendeeRow["ticket_status"],
    issued_at: row.issued_at,
    checked_in_at: row.status === "checked_in" ? row.updated_at : null,
  }));

  return { attendees, total, page, limit };
}

/** The row the admin attendee table renders, with the flags that decide which
 * actions are offered. Every "can" mirrors a server-side rule so the UI cannot
 * drift ahead of what the endpoints will accept. */
export interface AdminAttendeeRow extends AttendeeRow {
  survey: { sent: boolean; responded: boolean } | null;
  can_check_in: boolean;
  can_cancel: boolean;
  can_resend_ticket: boolean;
  can_send_survey: boolean;
  can_show_survey_send: boolean;
}

export type SurveyStatus = "disabled" | "locked" | "open" | "closed";

export interface AdminSurveyState {
  opt_in: boolean;
  finished: boolean;
  sendable: boolean;
  status: SurveyStatus;
}

export async function listAdminEventAttendees(
  supabase: DbClient,
  event: Event,
  options: { search: string; status: string; page: number; limit: number },
): Promise<{
  attendees: AdminAttendeeRow[];
  total: number;
  page: number;
  limit: number;
  survey: AdminSurveyState;
}> {
  const listed = await listEventAttendees(supabase, event.id, options);
  const { usable, hasSurvey, byUser } = await getAttendeeSurveyFlags(
    supabase,
    event,
    listed.attendees.map((attendee) => attendee.user_id),
  );
  const finished = isEventFinished(event.event_date, event.end_time);
  const windowOpen = !hasSurvey || usable;
  const surveySendable = event.survey_enabled && finished && windowOpen;

  const surveyStatus: SurveyStatus = !event.survey_enabled
    ? "disabled"
    : !finished
      ? "locked"
      : !windowOpen
        ? "closed"
        : "open";

  const attendees: AdminAttendeeRow[] = listed.attendees.map((row) => {
    const flag = byUser.get(row.user_id) ?? null;
    const responded = flag?.responded ?? false;
    return {
      ...row,
      survey: flag ? { sent: flag.sent, responded: flag.responded } : null,
      can_check_in: row.ticket_status === "issued",
      can_cancel: row.ticket_status === "issued",
      can_resend_ticket: row.ticket_status !== "cancelled",
      can_send_survey: surveySendable && row.ticket_status !== "cancelled" && !responded,
      can_show_survey_send: event.survey_enabled && row.ticket_status !== "cancelled" && !responded,
    };
  });

  return {
    attendees,
    total: listed.total,
    page: listed.page,
    limit: listed.limit,
    survey: { opt_in: event.survey_enabled, finished, sendable: surveySendable, status: surveyStatus },
  };
}
