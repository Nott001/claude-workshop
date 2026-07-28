import { supabase } from "@/shared/db/client";
import type { Ticket, SupportSession } from "@/shared/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TicketCallback = (ticket: Ticket) => void;
type SupportSessionCallback = (session: SupportSession) => void;

let sessionsCounter = 0;
let channelCounter = 0;

export function subscribeToSupportSessions(onChange: SupportSessionCallback): RealtimeChannel {
  const channelName = `support-sessions-${++sessionsCounter}`;
  const sub = supabase
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

export function subscribeToCheckins(eventId: number, onCheckin: TicketCallback): RealtimeChannel {
  const channelName = `checkins-${eventId}-${++channelCounter}`;
  const sub = supabase
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
