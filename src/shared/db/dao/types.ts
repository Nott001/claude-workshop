import type { SupabaseClient } from "@supabase/supabase-js";

export type DbClient = SupabaseClient;

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
