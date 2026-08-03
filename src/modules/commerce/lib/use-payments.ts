"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth";

interface Payment {
  payment_id: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  EVENTS: { title: string } | null;
}

export function usePayments() {
  const { isLoaded, isSignedIn } = useSession();
  const [payments, setPayments] = useState<Payment[]>([]);
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
