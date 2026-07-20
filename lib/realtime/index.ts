import { supabase } from "@/lib/db";
import type { ChatMessage } from "@/types";
import type { Ticket } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ChatCallback = (message: ChatMessage) => void;
type TicketCallback = (ticket: Ticket) => void;

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

export function subscribeToCheckins(eventId: number, onCheckin: TicketCallback): RealtimeChannel {
  const sub = supabase
    .channel(`checkins-${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "TICKETS",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        const ticket = payload.new as Ticket;
        if (ticket.status === "checked_in") {
          onCheckin(ticket);
        }
      },
    )
    .subscribe();

  return sub;
}
