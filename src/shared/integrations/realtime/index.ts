import { getBrowserClient } from "@/shared/db/browser-client";
import type { Ticket, SupportSession, ChatMessage, QaMessage } from "@/shared/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TicketCallback = (ticket: Ticket) => void;
type SupportSessionCallback = (session: SupportSession) => void;
type ChatMessageCallback = (message: ChatMessage) => void;
type QaMessageCallback = (message: QaMessage) => void;

let counter = 0;

export function subscribeToSupportSessions(onChange: SupportSessionCallback): RealtimeChannel {
  const channelName = `support-sessions-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "SUPPORT_SESSION",
      },
      (payload) => {
        const session = payload.new as SupportSession;
        onChange(session);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime subscribed: support-sessions");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Realtime subscription failed (support-sessions):", status);
      } else if (status === "CLOSED") {
        console.log("Realtime channel closed: support-sessions");
      }
    });

  return sub;
}

export function subscribeToSupportMessages(
  supportType: string,
  eventId?: number,
  onChange?: ChatMessageCallback,
): RealtimeChannel {
  const filter = `support_type=eq.${supportType}`;
  const channelName = `support-messages-${supportType}-${eventId ?? "general"}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "CHAT_MESSAGE",
        filter,
      },
      (payload) => {
        const msg = payload.new as ChatMessage;
        if (eventId && msg.event_id !== eventId) return;
        if (!eventId && msg.event_id !== null) return;
        onChange?.(msg);
      },
    )
    .subscribe();

  return sub;
}

export function subscribeToQaMessages(eventId: number, onChange?: QaMessageCallback): RealtimeChannel {
  const channelName = `qa-messages-${eventId}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "QA_MESSAGE",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          onChange?.(payload.new as QaMessage);
        }
      },
    )
    .subscribe();

  return sub;
}

export function subscribeToQaMessagesByModule(moduleId: number, onChange?: QaMessageCallback): RealtimeChannel {
  const channelName = `qa-module-messages-${moduleId}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
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
          onChange?.(payload.new as QaMessage);
        }
      },
    )
    .subscribe();

  return sub;
}

export function subscribeToCheckins(eventId: number, onCheckin: TicketCallback): RealtimeChannel {
  const channelName = `checkins-${eventId}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "TICKET",
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
