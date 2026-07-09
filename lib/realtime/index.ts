import { supabase } from "@/lib/db";
import type { LiveSessionState } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type StateCallback = (state: LiveSessionState) => void;

export function subscribeToLiveSession(eventId: number, onStateChange: StateCallback): RealtimeChannel {
  const channel = supabase
    .channel(`live-session-${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "LIVE_SESSION_STATE",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        const newState = payload.new as LiveSessionState;
        onStateChange(newState);
      },
    )
    .subscribe();

  return channel;
}
