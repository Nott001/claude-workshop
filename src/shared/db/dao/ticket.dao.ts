import type { DbClient } from "./types";
import { ilikePattern } from "./helpers";
import type { Ticket, TicketStatus, User } from "@/shared/types";

interface TicketWithUser extends Ticket {
  USER: Pick<User, "full_name" | "email"> | null;
}

interface TicketWithPaymentAndEvent extends Ticket {
  PAYMENT: { status: string; paid_at: string | null } | null;
  EVENT: {
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    venue_address: string | null;
    price: number;
    currency: string;
  } | null;
}

interface AttendeeRow {
  USER: Pick<User, "id" | "full_name" | "email"> | null;
  status: TicketStatus;
  issued_at: string;
  updated_at: string;
}

/**
 * What the query can hand back before normalization: PostgREST returns a single
 * object for a to-one embed, but the untyped client infers an array. Accept
 * either rather than asserting one and hoping.
 */
type RawAttendeeRow = Omit<AttendeeRow, "USER"> & {
  USER: AttendeeRow["USER"] | NonNullable<AttendeeRow["USER"]>[];
};

export async function findById(supabase: DbClient, id: number): Promise<Ticket | null> {
  const { data } = await supabase.from("TICKET").select("*").eq("id", id).single();
  return data;
}

export async function findByPaymentId(supabase: DbClient, paymentId: number): Promise<Ticket | null> {
  const { data } = await supabase.from("TICKET").select("*").eq("payment_id", paymentId).single();
  return data;
}

export async function findByQrToken(supabase: DbClient, qrToken: string): Promise<TicketWithUser | null> {
  const { data } = await supabase.from("TICKET").select("*, USER:user_id(full_name, email)").eq("qr_token", qrToken).single();
  return data;
}

export async function findActiveByUserAndEvent(supabase: DbClient, userId: number, eventId: number): Promise<Ticket[]> {
  const { data } = await supabase
    .from("TICKET")
    .select("*")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .limit(1);
  return (data ?? []) as Ticket[];
}

export async function listByUser(supabase: DbClient, userId: number): Promise<Ticket[]> {
  const { data } = await supabase
    .from("TICKET")
    .select("*, EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  return (data ?? []) as Ticket[];
}

export async function listAll(supabase: DbClient): Promise<Ticket[]> {
  const { data } = await supabase
    .from("TICKET")
    .select("*, EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)")
    .order("issued_at", { ascending: false });
  return (data ?? []) as Ticket[];
}

export async function findWithPaymentAndEvent(
  supabase: DbClient,
  paymentId: number,
): Promise<TicketWithPaymentAndEvent | null> {
  const { data } = await supabase
    .from("TICKET")
    .select(
      "*, PAYMENT(status, paid_at), EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)",
    )
    .eq("payment_id", paymentId)
    .single();
  return data;
}

export async function create(
  supabase: DbClient,
  data: {
    payment_id: number;
    user_id: number;
    event_id: number;
    qr_token: string;
  },
): Promise<Ticket | null> {
  const { error } = await supabase.from("TICKET").insert(data);
  if (error) {
    console.error("ticket.dao.create failed:", error.message, error.code);
    return null;
  }
  return data as unknown as Ticket;
}

export async function updateStatus(
  supabase: DbClient,
  paymentId: number,
  status: TicketStatus,
  checkedInBy?: number,
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (checkedInBy !== undefined) {
    updateData.checked_in_by = checkedInBy;
  }

  const { error } = await supabase.from("TICKET").update(updateData).eq("payment_id", paymentId);
  return !error;
}

export async function getAttendees(
  supabase: DbClient,
  eventId: number,
  options: {
    search?: string;
    status?: string;
    page: number;
    limit: number;
  },
): Promise<{ data: AttendeeRow[]; total: number }> {
  const { search = "", status = "all", page, limit } = options;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("TICKET")
    // The embed is an inner join because the search below filters on its
    // columns, and PostgREST can only filter an embedded resource it joins.
    .select("USER:user_id!inner(id, full_name, email), status, issued_at, updated_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });

  if (status === "checked_in") {
    query = query.eq("status", "checked_in");
  } else if (status === "not_checked_in") {
    query = query.in("status", ["issued"]);
  }

  if (search) {
    const pattern = ilikePattern(search);
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`, { referencedTable: "USER" });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count } = await query;

  const rows = (data ?? []) as unknown as RawAttendeeRow[];

  return {
    data: rows.map((row) => ({
      ...row,
      USER: Array.isArray(row.USER) ? (row.USER[0] ?? null) : row.USER,
    })),
    total: count ?? 0,
  };
}

export async function countByEvent(supabase: DbClient, eventId: number): Promise<number> {
  const { count } = await supabase
    .from("TICKET")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");
  return count ?? 0;
}

export async function deleteByPaymentIds(supabase: DbClient, paymentIds: number[]): Promise<boolean> {
  const { error } = await supabase.from("TICKET").delete().in("payment_id", paymentIds);
  return !error;
}
