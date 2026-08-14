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
