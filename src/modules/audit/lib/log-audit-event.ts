import type { DbClient } from "@/shared/db/dao/types";
import type { AuditAction } from "@/shared/types";

/**
 * Records an audit event. Non-throwing: a failed insert must not take the
 * action it audits down with it, but it is logged so the trail never silently
 * drops an event. Returns whether the row landed.
 */
export async function logAuditEvent(
  supabase: DbClient,
  actorId: number,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from("AUDIT_LOG").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error(`audit.logAuditEvent failed for ${action}:`, error.message, error.code);
    return false;
  }
  return true;
}

/**
 * `logAuditEvent` for operations whose contract includes the trail: throws
 * when the row cannot be written, so the caller surfaces the failure instead
 * of reporting success for an action that went unrecorded.
 */
export async function requireAuditEvent(
  supabase: DbClient,
  actorId: number,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!(await logAuditEvent(supabase, actorId, action, entityType, entityId, metadata))) {
    throw new Error("Failed to record audit event");
  }
}
