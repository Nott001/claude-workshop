import type { DbClient, PaginatedResult } from "./types";
import { pageBounds, throwOnDbError } from "./helpers";
import type { Payment, PaymentStatus } from "@/shared/types";

/** A PAYMENT row with the EVENT embed these reads select. Singular, not EVENTS. */
export interface PaymentWithEvent extends Payment {
  EVENT: { title: string } | null;
}

/**
 * The PAYMENT row the webhook path needs: enough to fulfill a payment without a
 * second round trip, since it carries the buyer and the event alongside.
 */
export interface PaymentWithEventAndUser extends Payment {
  EVENT: { title: string; event_date: string } | null;
  USER: { full_name: string; email: string } | null;
}

export async function findById(supabase: DbClient, id: number): Promise<PaymentWithEvent | null> {
  const { data, error } = await supabase.from("PAYMENT").select("*, EVENT(title)").eq("id", id).maybeSingle();
  throwOnDbError(error, "payment.dao.findById");
  return data;
}

export async function listByUser(
  supabase: DbClient,
  userId: number,
  options?: { page?: number; limit?: number },
): Promise<PaginatedResult<PaymentWithEvent>> {
  const { from, to, page, limit } = pageBounds(options);
  const { data, count } = await supabase
    .from("PAYMENT")
    .select("*, EVENT(title)", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  return { data: data ?? [], total: count ?? 0, page, limit };
}

export async function listAll(
  supabase: DbClient,
  options?: { page?: number; limit?: number },
): Promise<PaginatedResult<PaymentWithEvent>> {
  const { from, to, page, limit } = pageBounds(options);
  const { data, count } = await supabase
    .from("PAYMENT")
    .select("*, EVENT(title)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  return { data: data ?? [], total: count ?? 0, page, limit };
}

export async function findPendingByUserAndEvent(
  supabase: DbClient,
  userId: number,
  eventId: number,
): Promise<{ id: number; status: string } | null> {
  const { data } = await supabase
    .from("PAYMENT")
    .select("id, status")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function findLatestByUserAndEvent(
  supabase: DbClient,
  userId: number,
  eventId: number,
): Promise<{ id: number; status: string } | null> {
  const { data } = await supabase
    .from("PAYMENT")
    .select("id, status")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function create(
  supabase: DbClient,
  data: {
    user_id: number;
    event_id: number;
    amount: number;
    currency: string;
  },
): Promise<Payment | null> {
  const { data: payment, error } = await supabase.from("PAYMENT").insert(data).select("*").single();

  if (error) {
    console.error("payment.dao.create failed:", error.message, error.code);
    return null;
  }
  return payment;
}

export async function updateStatus(supabase: DbClient, id: number, status: PaymentStatus): Promise<boolean> {
  const updateData: Record<string, unknown> = { status };
  if (status === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  // `select` so an update that matched nothing is a failure rather than a
  // silent success; without it a no-op update is indistinguishable from a real one.
  const { data, error } = await supabase.from("PAYMENT").update(updateData).eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** Stores the provider's id for the payment so an inbound webhook can map back. */
export async function updateGatewayReference(supabase: DbClient, id: number, reference: string): Promise<boolean> {
  const { data, error } = await supabase.from("PAYMENT").update({ gateway_reference_id: reference }).eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** The payment a webhook names, with the buyer and event it needs to fulfill. */
export async function findByGatewayReference(supabase: DbClient, reference: string): Promise<PaymentWithEventAndUser | null> {
  const { data, error } = await supabase
    .from("PAYMENT")
    .select("*, EVENT(title, event_date), USER:user_id(full_name, email)")
    .eq("gateway_reference_id", reference)
    .maybeSingle();
  throwOnDbError(error, "payment.dao.findByGatewayReference");
  return data;
}

export async function deleteByEvent(supabase: DbClient, eventId: number): Promise<number[]> {
  const { data: payments } = await supabase.from("PAYMENT").select("id").eq("event_id", eventId);
  const ids = (payments ?? []).map((p) => p.id);

  if (ids.length > 0) {
    await supabase.from("PAYMENT").delete().in("id", ids);
  }

  return ids;
}

export async function findByIdWithEvent(supabase: DbClient, id: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("PAYMENT")
    .select("id, status, EVENT(title, price, currency, status)")
    .eq("id", id)
    .maybeSingle();
  throwOnDbError(error, "payment.dao.findByIdWithEvent");
  return data;
}

export async function findEventForPayment(
  supabase: DbClient,
  eventId: number,
): Promise<{
  title: string;
  price: number;
  currency: string;
  status: string;
  event_date: string;
  capacity: number | null;
} | null> {
  const { data, error } = await supabase
    .from("EVENT")
    .select("title, price, currency, status, event_date, capacity")
    .eq("id", eventId)
    .maybeSingle();
  throwOnDbError(error, "payment.dao.findEventForPayment");
  return data;
}
