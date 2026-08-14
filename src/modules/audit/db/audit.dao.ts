import type { DbClient, PaginatedResult } from "@/shared/db/dao/types";
import type { AuditLog, User } from "@/shared/types";
import { ilikePattern } from "@/shared/db/dao/helpers";

/** An AUDIT_LOG row with the ACTOR embed `list` aliases from actor_id. */
export interface AuditLogWithActor extends AuditLog {
  ACTOR: Pick<User, "id" | "full_name" | "email"> | null;
}

const BASE_SELECT = "*, ACTOR:actor_id(id, full_name, email)";
const SEARCH_SELECT = "*, ACTOR:actor_id!inner(id, full_name, email)";

export async function list(
  supabase: DbClient,
  options: { page: number; limit: number; search?: string },
): Promise<PaginatedResult<AuditLogWithActor>> {
  const { page, limit, search } = options;
  const offset = (page - 1) * limit;

  // The actor filter is an embedded join, so it only exists when a term is
  // present: making the embed inner when there is no search would silently
  // drop every row whose actor is missing, and paying for the join on every
  // page read would slow the default listing. Runs under the service client,
  // where the embed filter is not blocked by the grant limits AGENTS.md notes.
  const select = search ? SEARCH_SELECT : BASE_SELECT;

  let query = supabase.from("AUDIT_LOG").select(select, { count: "exact" });
  query = query.order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `action.ilike.${ilikePattern(search)},entity_type.ilike.${ilikePattern(search)},ACTOR.full_name.ilike.${ilikePattern(search)},ACTOR.email.ilike.${ilikePattern(search)}`,
    );
  }

  const { data, count } = await query.range(offset, offset + limit - 1);

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  };
}
