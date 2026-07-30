import type { DbClient } from "./types";
import type { QaMessage } from "@/shared/types";

export async function listQuestionsByModule(
  supabase: DbClient,
  moduleId: number,
  options: {
    before?: string | null;
    after?: string | null;
    limit: number;
  },
): Promise<{ messages: QaMessage[]; nextCursor: string | null }> {
  const { before, after, limit } = options;

  let query = supabase
    .from("QA_MESSAGE")
    .select("*, USER:user_id(full_name, role)")
    .eq("module_id", moduleId)
    .is("deleted_at", null);

  if (after) {
    query = query.gt("created_at", after).order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data } = await query.limit(limit + 1);

  const messages = (data ?? []) as unknown as QaMessage[];
  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].created_at : null;

  if (!after) result.reverse();

  return { messages: result, nextCursor };
}

export async function sendQuestion(
  supabase: DbClient,
  data: {
    event_id: number;
    module_id: number;
    user_id: number;
    message: string;
  },
): Promise<QaMessage | null> {
  const { data: message, error } = await supabase
    .from("QA_MESSAGE")
    .insert(data)
    .select("*, USER:user_id(full_name, role)")
    .single();

  if (error) return null;
  return message;
}

export async function findById(supabase: DbClient, id: number): Promise<QaMessage | null> {
  const { data } = await supabase.from("QA_MESSAGE").select("*").eq("id", id).single();
  return data;
}

export async function updateMessage(supabase: DbClient, id: number, updates: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("QA_MESSAGE").update(updates).eq("id", id);
  return !error;
}

export async function softDelete(supabase: DbClient, ids: number[]): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("QA_MESSAGE").update({ deleted_at: now, updated_at: now }).in("id", ids);
  return !error;
}
