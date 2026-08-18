import type { DbClient } from "@/shared/db/dao/types";
import { runCursorFeed, throwOnDbError } from "@/shared/db/dao/helpers";
import type { QaMessage, UserRole } from "@/shared/types";

export async function findByIdWithUser(
  supabase: DbClient,
  id: number,
): Promise<(QaMessage & { USER: { full_name: string; role: UserRole } }) | null> {
  const { data, error } = await supabase
    .from("QA_MESSAGE")
    .select("*, USER:user_id(full_name, role)")
    .eq("id", id)
    .maybeSingle();
  throwOnDbError(error, "qa-message.dao.findByIdWithUser");
  return data as unknown as (QaMessage & { USER: { full_name: string; role: UserRole } }) | null;
}

export async function listQuestionsByModule(
  supabase: DbClient,
  moduleId: number,
  options: {
    before?: string | null;
    after?: string | null;
    limit: number;
  },
): Promise<{ messages: QaMessage[]; nextCursor: string | null }> {
  const query = supabase.from("QA_MESSAGE").select("*, USER:user_id(full_name, role)").eq("module_id", moduleId);

  const { data, nextCursor } = await runCursorFeed<QaMessage>(query, "created_at", options);
  return { messages: data, nextCursor };
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
  const { data, error } = await supabase.from("QA_MESSAGE").select("*").eq("id", id).maybeSingle();
  throwOnDbError(error, "qa-message.dao.findById");
  return data;
}

export async function deleteByIds(supabase: DbClient, ids: number[]): Promise<boolean> {
  const { error } = await supabase.from("QA_MESSAGE").delete().in("id", ids);
  return !error;
}

export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("QA_MESSAGE").delete().eq("user_id", userId);
  return !error;
}
