"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TicketPass } from "@/modules/commerce/components/ticket-pass";
import { subscribeToTicket, unsubscribe } from "@/shared/integrations/realtime";
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";

export default function TicketPassPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<TicketWithEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tickets/detail/${ticketId}`)
      .then((r) => (r.ok ? (r.json() as Promise<TicketWithEvent>) : Promise.reject(new Error("Failed to load ticket"))))
      .then((data) => !cancelled && setTicket(data))
      .catch(() => !cancelled && setTicket(null))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  // Flip the pass the moment the kiosk admits the holder. updated_at IS the
  // check-in time (the row's `checked_in_at` column is never written), so the
  // live merge forwards it straight into the banner.
  const ticketIdNum = ticket?.id;
  useEffect(() => {
    if (ticketIdNum === undefined) return;
    const sub = subscribeToTicket(ticketIdNum, (live) => {
      setTicket((prev) => (prev ? { ...prev, status: live.status, updated_at: live.updated_at } : prev));
    });
    return () => {
      unsubscribe(sub);
    };
  }, [ticketIdNum]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg p-8">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg p-8">
        <p className="text-sm text-muted-fg">Ticket not found or unavailable.</p>
      </div>
    );
  }

  return <TicketPass ticket={ticket} />;
}
