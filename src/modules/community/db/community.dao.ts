import type { DbClient } from "@/shared/db/dao/types";
import { throwOnDbError } from "@/shared/db/dao/helpers";
import type { CommunityLink } from "@/shared/types";

export type CreateCommunityLinkInput = Pick<CommunityLink, "label" | "url" | "description" | "icon_url" | "sequence_order">;
export type UpdateCommunityLinkInput = Partial<CreateCommunityLinkInput> & { is_hidden?: boolean };

export async function list(supabase: DbClient, includeHidden: boolean): Promise<CommunityLink[]> {
  let query = supabase.from("COMMUNITY_LINK").select("*").order("sequence_order", { ascending: true });
  if (!includeHidden) {
    query = query.eq("is_hidden", false);
  }
  const { data, error } = await query;
  throwOnDbError(error, "community.dao.list");
  return data ?? [];
}

export async function findById(supabase: DbClient, id: number): Promise<CommunityLink | null> {
  const { data, error } = await supabase.from("COMMUNITY_LINK").select("*").eq("id", id).maybeSingle();
  throwOnDbError(error, "community.dao.findById");
  return data;
}

export async function getMaxSequenceOrder(supabase: DbClient): Promise<number> {
  const { data, error } = await supabase
    .from("COMMUNITY_LINK")
    .select("sequence_order")
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnDbError(error, "community.dao.getMaxSequenceOrder");
  return data?.sequence_order ?? 0;
}

export async function create(
  supabase: DbClient,
  input: CreateCommunityLinkInput,
  createdBy: number,
): Promise<CommunityLink | null> {
  const { data, error } = await supabase
    .from("COMMUNITY_LINK")
    .insert({ ...input, created_by: createdBy })
    .select("*")
    .single();

  if (error) {
    console.error("community.dao.create failed:", error.message, error.code);
    return null;
  }
  return data;
}

export async function update(supabase: DbClient, id: number, input: UpdateCommunityLinkInput): Promise<CommunityLink | null> {
  const { data, error } = await supabase.from("COMMUNITY_LINK").update(input).eq("id", id).select("*").single();

  if (error) {
    console.error("community.dao.update failed:", error.message, error.code);
    return null;
  }
  return data;
}

export async function remove(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("COMMUNITY_LINK").delete().eq("id", id);
  return !error;
}
