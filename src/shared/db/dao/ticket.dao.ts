import type { DbClient, PaginatedResult } from "./types";
import { ilikePattern, pageBounds, throwOnDbError } from "./helpers";
import type { Payment, Ticket, TicketStatus, User } from "@/shared/types";

interface TicketWithUser extends Ticket {
  USER: Pick<User, "full_name" | "email"> | null;
}

/** The EVENT columns every ticket surface renders. Embedded under `EVENT`. */
export interface TicketEvent {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  price: number;
  currency: string;
}

export interface TicketWithPaymentAndEvent extends Ticket {
  EVENT: TicketEvent | null;
  PAYMENT: Pick<Payment, "status" | "paid_at"> | null;
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
  const { data, error } = await supabase.from("TICKET").select("*").eq("id", id).maybeSingle();
  throwOnDbError(error, "ticket.dao.findById");
  return data;
}

export async function findByPaymentId(supabase: DbClient, paymentId: number): Promise<Ticket | null> {
  const { data, error } = await supabase.from("TICKET").select("*").eq("payment_id", paymentId).maybeSingle();
  throwOnDbError(error, "ticket.dao.findByPaymentId");
  return data;
}

export async function findByQrToken(supabase: DbClient, qrToken: string): Promise<TicketWithUser | null> {
  const { data, error } = await supabase
    .from("TICKET")
    .select("*, USER:user_id(full_name, email)")
    .eq("qr_token", qrToken)
    .maybeSingle();
  throwOnDbError(error, "ticket.dao.findByQrToken");
  return data;
}

/**
 * The live (non-cancelled) ticket a user holds for an event, if any. Shared by
 * the commerce duplicate-ticket check and course-access eligibility so the
 * "who may attend" rule lives in one place.
 */
export async function findActiveTicketByUserAndEvent(
  supabase: DbClient,
  userId: number,
  eventId: number,
): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from("TICKET")
    .select("*")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .maybeSingle();
  throwOnDbError(error, "ticket.dao.findActiveTicketByUserAndEvent");
  return data;
}

/** The same live-ticket lookup, carrying the owner's name and email for admin
 * actions (manual check-in notification, ticket re-send) that need them. */
export async function findActiveTicketWithUser(
  supabase: DbClient,
  userId: number,
  eventId: number,
): Promise<TicketWithUser | null> {
  const { data, error } = await supabase
    .from("TICKET")
    .select("*, USER:user_id(full_name, email)")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .maybeSingle();
  throwOnDbError(error, "ticket.dao.findActiveTicketWithUser");
  return data;
}

// Everything a ticket card renders, so it never has to ask a second time.
const TICKET_CARD_SELECT =
  "*, PAYMENT(status, paid_at), EVENT(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)";

export async function listByUser(
  supabase: DbClient,
  userId: number,
  options?: { page?: number; limit?: number },
): Promise<PaginatedResult<TicketWithPaymentAndEvent>> {
  const { from, to, page, limit } = pageBounds(options);
  const { data, count } = await supabase
    .from("TICKET")
    .select(TICKET_CARD_SELECT, { count: "exact" })
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .range(from, to);
  return { data: data ?? [], total: count ?? 0, page, limit };
}

export async function listAll(
  supabase: DbClient,
  options?: { page?: number; limit?: number },
): Promise<PaginatedResult<TicketWithPaymentAndEvent>> {
  const { from, to, page, limit } = pageBounds(options);
  const { data, count } = await supabase
    .from("TICKET")
    .select(TICKET_CARD_SELECT, { count: "exact" })
    .order("issued_at", { ascending: false })
    .range(from, to);
  return { data: data ?? [], total: count ?? 0, page, limit };
}

export async function findWithPaymentAndEvent(
  supabase: DbClient,
  paymentId: number,
): Promise<TicketWithPaymentAndEvent | null> {
  const { data, error } = await supabase.from("TICKET").select(TICKET_CARD_SELECT).eq("payment_id", paymentId).maybeSingle();
  throwOnDbError(error, "ticket.dao.findWithPaymentAndEvent");
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
  // Returns the stored row, not the input: the caller needs the generated id,
  // status and issued_at, and echoing the argument back fabricated a "Ticket"
  // that had none of them.
  const { data: ticket, error } = await supabase.from("TICKET").insert(data).select("*").single();
  if (error) {
    console.error("ticket.dao.create failed:", error.message, error.code);
    return null;
  }
  return ticket;
}

/**
 * Keyed on the primary key. `payment_id` is nullable (ON DELETE SET NULL), so
 * filtering on it addressed no rows once a payment was removed — the update
 * matched nothing, PostgREST reported no error, and check-in claimed success
 * while changing nothing.
 */
export async function updateStatus(
  supabase: DbClient,
  ticketId: number,
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

  // `select` so a filter that matches nothing is a failure rather than a
  // silent success; without it a no-op update is indistinguishable from a real one.
  const { data, error } = await supabase.from("TICKET").update(updateData).eq("id", ticketId).select("id");
  return !error && (data?.length ?? 0) > 0;
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

export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("TICKET").delete().eq("user_id", userId);
  return !error;
}
