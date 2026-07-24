import { supabase } from "@/lib/db";
import type { Payment, Ticket, SupportSession } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TicketCallback = (ticket: Ticket) => void;
type PaymentCallback = (payment: Payment) => void;
type SupportSessionCallback = (session: SupportSession) => void;

let channelCounter = 0;

export function subscribeToPaymentStatus(paymentId: number, onStatusChange: PaymentCallback): RealtimeChannel {
  const channelName = `payment-${paymentId}-${++channelCounter}`;
  const sub = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "PAYMENTS",
        filter: `payment_id=eq.${paymentId}`,
      },
      (payload) => {
        const payment = payload.new as Payment;
        onStatusChange(payment);
      },
    )
    .subscribe();

  return sub;
}

let sessionsCounter = 0;

export function subscribeToSupportSessions(onChange: SupportSessionCallback): RealtimeChannel {
  const channelName = `support-sessions-${++sessionsCounter}`;
  const sub = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "SUPPORT_SESSIONS",
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
