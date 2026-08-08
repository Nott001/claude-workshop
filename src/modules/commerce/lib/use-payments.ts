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

  const load = useCallback(async (page: number, append: boolean) => {
    try {
      const res = await fetch(`/api/payments?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) {
        setError("Failed to load payments");
        return;
      }
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as PaymentWithEvent[];
      setPayments((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore((data.total ?? 0) > page * PAGE_SIZE);
    } catch {
      setError("Failed to load payments");
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
      try {
        await load(1, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
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
    await load(next, true);
    setLoadingMore(false);
  }, [load, loadingMore]);

  return { payments, loading, loadingMore, error, hasMore, loadMore };
}
