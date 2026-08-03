import type { DbClient, PaginatedResult } from "./types";
import type { AuditLog, AuditAction, User } from "@/shared/types";

/** An AUDIT_LOG row with the ACTOR embed `list` aliases from actor_id. */
export interface AuditLogWithActor extends AuditLog {
  ACTOR: Pick<User, "id" | "full_name" | "email"> | null;
}

export async function log(
  supabase: DbClient,
  actorId: number,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("AUDIT_LOG").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
}

export async function list(supabase: DbClient, page: number, limit: number): Promise<PaginatedResult<AuditLogWithActor>> {
  const offset = (page - 1) * limit;

  const { data, count } = await supabase
    .from("AUDIT_LOG")
    .select("*, ACTOR:actor_id(id, full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  };
}
