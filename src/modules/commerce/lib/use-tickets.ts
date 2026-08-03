"use client";

import { useEffect, useState } from "react";
// The route serves ticketDao rows verbatim. The copy that used to live here
// named the embeds `EVENTS` and `PAYMENTS`; the selects alias neither, so both
// arrive singular. `ticket.EVENTS.title` was reading through `undefined`.
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";

export type Ticket = TicketWithEvent;
export type PaymentInfo = { status: string; paid_at: string | null };

export function useTickets() {
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/tickets");
      if (!res.ok) {
        setError("Failed to load tickets");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTickets(data);
      setLoading(false);
    }
    load();
  }, []);

  return { tickets, loading, error };
}
