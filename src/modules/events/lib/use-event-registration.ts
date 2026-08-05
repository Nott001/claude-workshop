"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";

interface EventData {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
}

interface RegisterPageData {
  event: EventData;
  user: { user_id: number; full_name: string; email: string };
  already_registered: boolean;
}

export function useEventRegistration(eventId: string) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useSession();
  const [data, setData] = useState<RegisterPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/register`);
      if (!res.ok) {
        setError("Failed to load registration page");
        setLoading(false);
        return;
      }
      const d = await res.json();
      setData(d);
      setLoading(false);
    }
    load();
  }, [eventId, isLoaded, isSignedIn, router]);

  async function handleRegister() {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/register`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Registration failed");
      setSubmitting(false);
      return;
    }

    const body = await res.json();

    if (body.pending_payment_id) {
      const payRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: Number(eventId) }),
      });

      const payBody = await payRes.json();
      if (payBody.payment_id) {
        router.push(`/checkout/${payBody.payment_id}?success=true`);
      } else {
        setError(payBody.error ?? "Failed to process payment");
        setSubmitting(false);
      }
      return;
    }

    const payRes = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: Number(eventId) }),
    });

    if (!payRes.ok) {
      const errBody = await payRes.json();
      if (errBody.payment_id) {
        router.push(`/checkout/${errBody.payment_id}?success=true`);
        return;
      }
      setError(errBody.error ?? "Failed to initiate payment");
      setSubmitting(false);
      return;
    }

    const { payment_id, checkout_url } = await payRes.json();
    if (payment_id) {
      router.push(`/checkout/${payment_id}?success=true`);
    } else if (checkout_url) {
      window.location.href = checkout_url;
    }
  }

  return { data, loading, agreed, setAgreed, submitting, error, handleRegister };
}
