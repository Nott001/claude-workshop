import type { AuditAction } from "@/types";
import { auditDao } from "@/lib/db/dao";

export async function logAuditEvent(
  supabase: ReturnType<typeof import("@/lib/db").getServiceClient>,
  clerkId: string,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
) {
  const user = await auditDao.findByClerkId(supabase, clerkId);
  if (!user) return;
  await auditDao.log(supabase, user.id, action, entityType, entityId, metadata);
}
