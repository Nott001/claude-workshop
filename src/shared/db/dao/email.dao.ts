import type { DbClient, PaginatedResult } from "./types";
import { pageBounds, throwOnDbError } from "./helpers";
import type { EmailLog, EmailType, EmailStatus, User } from "@/shared/types";

/** An EMAIL_LOG row with the USER embed both reads alias from user_id. */
export interface EmailLogWithUser extends EmailLog {
  USER: Pick<User, "full_name" | "email"> | null;
}

export async function findById(supabase: DbClient, id: number): Promise<EmailLogWithUser | null> {
  const { data, error } = await supabase
    .from("EMAIL_LOG")
    .select("*, USER:user_id(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  throwOnDbError(error, "email.dao.findById");
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
    page?: number;
    limit?: number;
  },
): Promise<PaginatedResult<EmailLogWithUser>> {
  const { from, to, page, limit } = pageBounds(filters);
  let query = supabase
    .from("EMAIL_LOG")
    .select("*, USER:user_id(full_name, email)", { count: "exact" })
    .order("sent_at", { ascending: false });

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

  query = query.range(from, to);

  const { data, count } = await query;
  return { data: data ?? [], total: count ?? 0, page, limit };
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
