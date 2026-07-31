import type { DbClient } from "./types";
import type { Payment, PaymentStatus } from "@/shared/types";

export async function findById(supabase: DbClient, id: number): Promise<Payment | null> {
  const { data } = await supabase.from("PAYMENT").select("*, EVENT(title)").eq("id", id).single();
  return data;
}

export async function listByUser(supabase: DbClient, userId: number): Promise<Payment[]> {
  const { data } = await supabase
    .from("PAYMENT")
    .select("*, EVENT(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Payment[];
}

export async function listAll(supabase: DbClient): Promise<Payment[]> {
  const { data } = await supabase.from("PAYMENT").select("*, EVENT(title)").order("created_at", { ascending: false });
  return (data ?? []) as Payment[];
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
  const { error } = await supabase.from("PAYMENT").update({ status, paid_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function findByIdWithEvent(supabase: DbClient, id: number): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("PAYMENT")
    .select("id, status, EVENT(title, price, currency, status)")
    .eq("id", id)
    .single();
  return data;
}

export async function findEventForPayment(
  supabase: DbClient,
  eventId: number,
): Promise<{ title: string; price: number; currency: string; status: string; event_date: string } | null> {
  const { data } = await supabase.from("EVENT").select("title, price, currency, status, event_date").eq("id", eventId).single();
  return data;
}
