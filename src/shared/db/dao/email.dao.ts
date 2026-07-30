import type { DbClient } from "./types";
import type { EmailLog, EmailType, EmailStatus } from "@/shared/types";

export async function findById(supabase: DbClient, id: number): Promise<EmailLog | null> {
  const { data } = await supabase.from("EMAIL_LOG").select("*, USER:user_id(full_name, email)").eq("id", id).single();
  return data;
}

export async function list(
  supabase: DbClient,
  filters?: {
    email_type?: string;
    status?: string;
    user_id?: string;
    date_from?: string;
    date_to?: string;
  },
): Promise<EmailLog[]> {
  let query = supabase.from("EMAIL_LOG").select("*, USER:user_id(full_name, email)").order("sent_at", { ascending: false });

  if (filters?.email_type) {
    query = query.eq("email_type", filters.email_type);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.user_id) {
    query = query.eq("user_id", filters.user_id);
  }
  if (filters?.date_from) {
    query = query.gte("sent_at", filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte("sent_at", filters.date_to);
  }

  const { data } = await query;
  return (data ?? []) as EmailLog[];
}

export async function insert(
  supabase: DbClient,
  data: {
    user_id: number;
    email_type: EmailType;
    status: EmailStatus;
    sent_at: string;
  },
): Promise<boolean> {
  const { error } = await supabase.from("EMAIL_LOG").insert(data);
  if (error) {
    console.warn("EMAIL_LOG insert failed:", error.message);
    return false;
  }
  return true;
}
