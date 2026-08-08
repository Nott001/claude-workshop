"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// The route serves ticketDao rows verbatim. The copy that used to live here
// named the embeds `EVENTS` and `PAYMENTS`; the selects alias neither, so both
// arrive singular. `ticket.EVENTS.title` was reading through `undefined`.
import type { TicketWithPaymentAndEvent } from "@/shared/db/dao/ticket.dao";

export type Ticket = TicketWithPaymentAndEvent;

const PAGE_SIZE = 50;

export function useTickets() {
  const [tickets, setTickets] = useState<TicketWithPaymentAndEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(
    async (page: number): Promise<{ rows: TicketWithPaymentAndEvent[]; hasMore: boolean; ok: boolean }> => {
      try {
        const res = await fetch(`/api/tickets?page=${page}&limit=${PAGE_SIZE}`);
        if (!res.ok) return { rows: [], hasMore: false, ok: false };
        const data = await res.json();
        const rows = (Array.isArray(data.data) ? data.data : []) as TicketWithPaymentAndEvent[];
        return { rows, hasMore: (data.total ?? 0) > page * PAGE_SIZE, ok: true };
      } catch {
        return { rows: [], hasMore: false, ok: false };
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    async function loadFirstPage() {
      setLoading(true);
      setError(null);
      const result = await load(1);
      // Not on a superseded run: that one leaves every flag to its replacement.
      if (cancelled) return;
      if (!result.ok) setError("Failed to load tickets");
      setTickets(result.rows);
      setHasMore(result.hasMore);
      setLoading(false);
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    pageRef.current = next;
    const result = await load(next);
    if (!result.ok) setError("Failed to load tickets");
    setTickets((prev) => [...prev, ...result.rows]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }, [load, loadingMore]);

  return { tickets, loading, loadingMore, error, hasMore, loadMore };
}
