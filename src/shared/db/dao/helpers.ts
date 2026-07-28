import type { DbClient } from "./types";

export async function findById<T>(supabase: DbClient, table: string, id: number): Promise<T | null> {
  const { data } = await supabase.from(table).select("*").eq("id", id).single();
  return (data as T) ?? null;
}

export async function exists(supabase: DbClient, table: string, id: number): Promise<boolean> {
  const { data } = await supabase.from(table).select("id", { head: true }).eq("id", id).single();
  return !!data;
}

export async function findByField<T>(
  supabase: DbClient,
  table: string,
  field: string,
  value: unknown,
  select = "*",
): Promise<T | null> {
  const { data } = await supabase.from(table).select(select).eq(field, value).single();
  return (data as T) ?? null;
}

export async function deleteById(supabase: DbClient, table: string, id: number): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  return !error;
}
