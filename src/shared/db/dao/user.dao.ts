import { ROLES, STAFF_ROLES } from "@/shared/lib/roles";
import type { DbClient, PaginatedResult } from "./types";
import { ilikePattern, throwOnDbError } from "./helpers";
import type { User } from "@/shared/types";

export async function findByAuthId(supabase: DbClient, authUserId: string): Promise<User | null> {
  const { data, error } = await supabase.from("USER").select("*").eq("auth_user_id", authUserId).maybeSingle();
  throwOnDbError(error, "user.dao.findByAuthId");
  return data;
}

export async function findById(supabase: DbClient, id: number): Promise<User | null> {
  const { data, error } = await supabase.from("USER").select("*").eq("id", id).maybeSingle();
  throwOnDbError(error, "user.dao.findById");
  return data;
}

export async function findStaffByEmail(supabase: DbClient, email: string): Promise<{ id: number } | null> {
  const { data } = await supabase.from("USER").select("id").eq("email", email).maybeSingle();
  return data;
}

export async function listStaff(
  supabase: DbClient,
  options: { page: number; search: string; pageSize?: number; role?: string },
): Promise<PaginatedResult<Pick<User, "id" | "full_name" | "email" | "role">>> {
  const { page, search, role } = options;
  const pageSize = options.pageSize ?? 10;
  let query = supabase
    .from("USER")
    .select("id, full_name, email, role", { count: "exact" })
    .in("role", [...STAFF_ROLES])
    .order("full_name", { ascending: true });

  if (search) {
    const pattern = ilikePattern(search);
    query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
  }
  if (role) {
    // Narrows the staff set; the route validates `role` before it gets here.
    query = query.eq("role", role);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count } = await query;

  return {
    data: (data ?? []) as Pick<User, "id" | "full_name" | "email" | "role">[],
    total: count ?? 0,
    page,
    limit: pageSize,
  };
}

export async function upsertUser(
  supabase: DbClient,
  data: {
    auth_user_id: string;
    email: string;
    full_name: string;
    role?: string;
  },
): Promise<User | null> {
  const upsertPayload: Record<string, unknown> = {
    auth_user_id: data.auth_user_id,
    email: data.email,
    full_name: data.full_name,
  };
  if (data.role) {
    upsertPayload.role = data.role;
  }

  const { data: result, error } = await supabase
    .from("USER")
    .upsert(upsertPayload, { onConflict: "auth_user_id" })
    .select("*")
    .single();

  if (error || !result) return null;
  return result;
}

export async function updateUser(
  supabase: DbClient,
  authUserId: string,
  data: { full_name?: string; email?: string; profile_image_url?: string | null },
): Promise<User | null> {
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.profile_image_url !== undefined) updatePayload.profile_image_url = data.profile_image_url;

  const { data: result, error } = await supabase
    .from("USER")
    .update(updatePayload)
    .eq("auth_user_id", authUserId)
    .select("*")
    .single();

  if (error || !result) return null;
  return result;
}

export async function updateRole(
  supabase: DbClient,
  id: number,
  role: User["role"],
): Promise<Pick<User, "id" | "full_name" | "email" | "role"> | null> {
  const { data } = await supabase
    .from("USER")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, full_name, email, role")
    .single();
  return data;
}

export async function removeById(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("USER").delete().eq("id", id);
  return !error;
}

export async function deleteByAuthId(supabase: DbClient, authUserId: string): Promise<boolean> {
  const { error } = await supabase.from("USER").delete().eq("auth_user_id", authUserId);
  return !error;
}

export async function findByAuthIdWithRole(supabase: DbClient, authUserId: string): Promise<Pick<User, "id" | "role"> | null> {
  const { data, error } = await supabase.from("USER").select("id, role").eq("auth_user_id", authUserId).maybeSingle();
  throwOnDbError(error, "user.dao.findByAuthIdWithRole");
  return data;
}
