import type { SupabaseClient } from "@supabase/supabase-js";

export type DbClient = SupabaseClient;

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
