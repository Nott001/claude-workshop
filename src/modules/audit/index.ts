import type { AuditAction } from "@/types";
import { auditDao } from "@/lib/db/dao";

export async function logAuditEvent(
  supabase: ReturnType<typeof import("@/lib/db").getServiceClient>,
  actorId: number,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
) {
  await auditDao.log(supabase, actorId, action, entityType, entityId, metadata);
}
