import type { AuditAction } from "@/types";

export async function logAuditEvent(
  supabase: ReturnType<typeof import("@/lib/db").getServiceClient>,
  clerkId: string,
  action: AuditAction,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>,
) {
  const { data: user } = await supabase.from("USERS").select("user_id").eq("clerk_id", clerkId).single();
  if (!user) return;

  await supabase.from("AUDIT_LOGS").insert({
    actor_id: user.user_id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
}
