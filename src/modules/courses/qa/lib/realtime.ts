import { getBrowserClient } from "@/shared/db/browser-client";
import type { QaMessage } from "@/shared/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface QaRealtimeCallbacks {
  onInsert?: (message: QaMessage) => void;
  onUpdate?: (message: QaMessage) => void;
  onDelete?: (message: QaMessage) => void;
}

/**
 * Subscribes to QA_MESSAGE changes for one module. The channel name is stable
 * per moduleId (no counter suffix): remounting the panel must re-use the same
 * topic so strict-mode remounts do not accumulate dead channels until the
 * socket hits its topic limit.
 */
export function subscribeToQaMessagesByModule(moduleId: number, callbacks: QaRealtimeCallbacks): RealtimeChannel {
  const sub = getBrowserClient()
    .channel(`qa-module-${moduleId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "QA_MESSAGE",
        filter: `module_id=eq.${moduleId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          callbacks.onInsert?.(payload.new as QaMessage);
        } else if (payload.eventType === "UPDATE") {
          callbacks.onUpdate?.(payload.new as QaMessage);
        } else if (payload.eventType === "DELETE") {
          callbacks.onDelete?.(payload.old as QaMessage);
        }
      },
    )
    .subscribe();

  return sub;
}

/**
 * Subscribes to the module's lock column. MODULE is already a member of the
 * supabase_realtime publication with a `USING (true)` read policy, so the
 * browser gets UPDATE events under its own role. The default replica identity
 * sends only the changed columns, and is_locked is what the lock PATCH
 * changes, so the payload carries it; anything else is ignored.
 */
export function subscribeToModuleLock(moduleId: number, onLockChange: (isLocked: boolean) => void): RealtimeChannel {
  return getBrowserClient()
    .channel(`module-lock-${moduleId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "MODULE",
        filter: `id=eq.${moduleId}`,
      },
      (payload) => {
        const isLocked = (payload.new as { is_locked?: unknown }).is_locked;
        if (typeof isLocked === "boolean") onLockChange(isLocked);
      },
    )
    .subscribe();
}
