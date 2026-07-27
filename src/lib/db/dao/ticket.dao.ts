import type { DbClient } from "./types";
import type { Ticket, TicketStatus } from "@/types";

export async function findById(supabase: DbClient, id: number): Promise<Ticket | null> {
  const { data } = await supabase.from("TICKET").select("*").eq("id", id).single();
  return data;
}

export async function findByPaymentId(supabase: DbClient, paymentId: number): Promise<Ticket | null> {
  const { data } = await supabase.from("TICKET").select("*").eq("payment_id", paymentId).single();
  return data;
}

export async function findByQrToken(supabase: DbClient, qrToken: string): Promise<unknown> {
  const { data } = await supabase.from("TICKET").select("*, USER:id(full_name, email)").eq("qr_token", qrToken).single();
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

export async function findWithPaymentAndEvent(supabase: DbClient, paymentId: number): Promise<unknown> {
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
  return error ? null : (data as unknown as Ticket);
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
): Promise<{ data: unknown[]; total: number }> {
  const { search = "", status = "all", page, limit } = options;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("TICKET")
    .select("USER:id(id, full_name, email), status, issued_at, updated_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("issued_at", { ascending: false });

  if (status === "checked_in") {
    query = query.eq("status", "checked_in");
  } else if (status === "not_checked_in") {
    query = query.in("status", ["issued"]);
  }

  if (search) {
    query = query.or(`USER.full_name.ilike.%${search}%,USER.email.ilike.%${search}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  return {
    data: (data ?? []) as unknown[],
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
