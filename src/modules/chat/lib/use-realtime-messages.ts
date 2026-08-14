"use client";

import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/shared/db/browser-client";
import { unsubscribe } from "@/shared/integrations/realtime";

interface UseRealtimeMessagesOptions<T extends { id: number }> {
  /**
   * Stable channel name derived from the resource id. `Date.now()` in the name
   * defeats strict-mode cleanup by forcing a new channel per mount; a stable
   * name is removed on unmount and re-created cleanly on remount.
   */
  channelName: string;
  /** postgres_changes filter, e.g. `support_type=eq.general`. */
  filter: string;
  /** Skip subscribing until true (e.g. a closed panel). */
  enabled?: boolean;
  /**
   * Gate the raw INSERT row before it is enriched; return false to ignore it.
   * Runs against the un-joined realtime payload.
   */
  relevant?: (row: T) => boolean;
  /** Called with the pre-joined row for every accepted INSERT. */
  onInsert: (message: T) => void;
  /** Called with the raw payload row on UPDATE. */
  onUpdate?: (message: T) => void;
  /** Called with the raw payload row on DELETE. */
  onDelete?: (message: T) => void;
}

/**
 * One chat subscription, shared by the panels and the support inbox. Realtime
 * INSERT payloads carry no joined author row, so the hook refetches the message
 * through the DAO-backed support GET route — the browser never queries the
 * database under the anon key, keeping enrichment server-side.
 */
export function useRealtimeMessages<T extends { id: number }>({
  channelName,
  filter,
  enabled = true,
  relevant,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeMessagesOptions<T>): void {
  const handlersRef = useRef({ relevant, onInsert, onUpdate, onDelete });

  useEffect(() => {
    handlersRef.current = { relevant, onInsert, onUpdate, onDelete };
  });

  useEffect(() => {
    if (!enabled) return;

    const sub = getBrowserClient()
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "CHAT_MESSAGE", filter }, async (payload) => {
        const current = handlersRef.current;
        if (payload.eventType === "INSERT") {
          const row = payload.new as T;
          if (current.relevant && !current.relevant(row)) return;
          const full = await fetchEnriched((row as { id: number }).id);
          if (full) current.onInsert(full as T);
        } else if (payload.eventType === "UPDATE") {
          current.onUpdate?.(payload.new as T);
        } else if (payload.eventType === "DELETE") {
          current.onDelete?.(payload.old as T);
        }
      })
      .subscribe();

    return () => unsubscribe(sub);
  }, [channelName, filter, enabled]);
}

async function fetchEnriched(id: number): Promise<{ id: number } | null> {
  try {
    const res = await fetch(`/api/support/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as { id: number };
  } catch {
    return null;
  }
}
