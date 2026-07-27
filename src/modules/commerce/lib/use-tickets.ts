"use client";

import { useEffect, useState } from "react";

export interface PaymentInfo {
  status: string;
  paid_at: string | null;
}

interface TicketEvent {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  price: number;
  currency: string;
}

export interface Ticket {
  payment_id: number;
  event_id: number;
  qr_token: string;
  status: string;
  issued_at: string;
  PAYMENTS: PaymentInfo | PaymentInfo[];
  EVENTS: TicketEvent;
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
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
