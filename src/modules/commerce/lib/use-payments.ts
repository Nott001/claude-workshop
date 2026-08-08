"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
// The route serves paymentDao rows verbatim. The copy that used to live here
// called the key `payment_id` (PAYMENT's key is `id`) and the embed `EVENTS`
// (it is `EVENT`), so every row had an undefined key and an "Unknown" event.
import type { PaymentWithEvent } from "@/shared/db/dao/payment.dao";

const PAGE_SIZE = 50;

export function usePayments() {
  const { isLoaded, isSignedIn } = useSession();
  const [payments, setPayments] = useState<PaymentWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(async (page: number): Promise<{ rows: PaymentWithEvent[]; hasMore: boolean; ok: boolean }> => {
    try {
      const res = await fetch(`/api/payments?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) return { rows: [], hasMore: false, ok: false };
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as PaymentWithEvent[];
      return { rows, hasMore: (data.total ?? 0) > page * PAGE_SIZE, ok: true };
    } catch {
      return { rows: [], hasMore: false, ok: false };
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    let cancelled = false;
    pageRef.current = 1;

    async function loadFirstPage() {
      setLoading(true);
      setError(null);
      const result = await load(1);
      // Not on a superseded run: that one leaves every flag to its replacement.
      if (cancelled) return;
      if (!result.ok) setError("Failed to load payments");
      setPayments(result.rows);
      setHasMore(result.hasMore);
      setLoading(false);
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    pageRef.current = next;
    const result = await load(next);
    if (!result.ok) setError("Failed to load payments");
    setPayments((prev) => [...prev, ...result.rows]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }, [load, loadingMore]);

  return { payments, loading, loadingMore, error, hasMore, loadMore };
}
