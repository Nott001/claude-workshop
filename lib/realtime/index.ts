import { supabase } from "@/lib/db";
import type { LiveSessionState } from "@/types";
import type { ChatMessage } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type StateCallback = (state: LiveSessionState) => void;
type ChatCallback = (message: ChatMessage) => void;

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

export function subscribeToChatMessages(
  eventId: number,
  channel: "support" | "live_qa",
  onMessage: ChatCallback,
): RealtimeChannel {
  const sub = supabase
    .channel(`chat-${eventId}-${channel}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "CHAT_MESSAGES",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.channel === channel && !msg.deleted_at) {
          onMessage(msg);
        }
      },
    )
    .subscribe();

  return sub;
}
