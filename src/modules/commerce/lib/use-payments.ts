"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth";
// The route serves paymentDao rows verbatim. The copy that used to live here
// called the key `payment_id` (PAYMENT's key is `id`) and the embed `EVENTS`
// (it is `EVENT`), so every row had an undefined key and an "Unknown" event.
import type { PaymentWithEvent } from "@/shared/db/dao/payment.dao";

export function usePayments() {
  const { isLoaded, isSignedIn } = useSession();
  const [payments, setPayments] = useState<PaymentWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/payments");
      if (!res.ok) {
        setError("Failed to load payments");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPayments(data);
      setLoading(false);
    }
    load();
  }, [isLoaded, isSignedIn]);

  return { payments, loading, error };
}
