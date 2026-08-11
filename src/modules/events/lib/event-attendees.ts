import type { DbClient } from "@/shared/db/dao/types";
import * as ticketDao from "@/shared/db/dao/ticket.dao";

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
