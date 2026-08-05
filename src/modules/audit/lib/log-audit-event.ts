import type { DbClient } from "@/shared/db/dao/types";
import type { AuditAction } from "@/shared/types";

export async function logAuditEvent(
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
