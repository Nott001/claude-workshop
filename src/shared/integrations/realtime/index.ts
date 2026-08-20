import { getBrowserClient } from "@/shared/db/browser-client";
import type { Ticket, SupportSession } from "@/shared/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TicketCallback = (ticket: Ticket) => void;
type SupportSessionCallback = (session: SupportSession) => void;

let counter = 0;

/**
 * Tears a subscription down. `channel.unsubscribe()` closes the socket topic but
 * leaves the channel registered on the client, so remounting accumulates dead
 * channels until the connection hits its topic limit and new subscriptions
 * silently stop arriving. `removeChannel` does both halves.
 *
 * Exported from here rather than called at each site because the caller should
 * not have to know which client owns the channel it was handed.
 */
export function unsubscribe(channel: RealtimeChannel): void {
  getBrowserClient().removeChannel(channel);
}

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

export function subscribeToTicket(ticketId: number, onTicket: TicketCallback): RealtimeChannel {
  const channelName = `ticket-${ticketId}-${++counter}`;
  const sub = getBrowserClient()
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "TICKET",
        filter: `id=eq.${ticketId}`,
      },
      (payload) => {
        const ticket = payload.new as Ticket;
        if (ticket.status === "checked_in" || ticket.status === "cancelled") {
          onTicket(ticket);
        }
      },
    )
    .subscribe();

  return sub;
}

/**
 * Subscribes to a course's live highlight. The channel name is stable per
 * courseId (no counter suffix) for the same reason the QA channels are: the
 * room remounts on navigation and must reuse one topic rather than piling up
 * dead channels. LIVE_SESSION_STATE joined the supabase_realtime publication
 * in 00015 and its read RLS is USING (true), so the browser's own role gets
 * the UPDATE events carrying the new highlighted_lesson_id.
 */
export function subscribeToCourseHighlight(
  courseId: number,
  onChange: (highlightedLessonId: number | null) => void,
): RealtimeChannel {
  return getBrowserClient()
    .channel(`live-highlight-${courseId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "LIVE_SESSION_STATE",
        filter: `course_id=eq.${courseId}`,
      },
      (payload) => {
        onChange((payload.new as { highlighted_lesson_id: number | null }).highlighted_lesson_id);
      },
    )
    .subscribe();
}
