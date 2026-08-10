"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { paymentDestination } from "@/modules/events/lib/event-registration-policy";

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

    const registerBody = await res.json();
    const payRes = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: Number(eventId) }),
    });

    const destination = paymentDestination(await payRes.json(), {
      pending: registerBody.pending_payment_id != null,
      ok: payRes.ok,
    });

    switch (destination.kind) {
      case "checkout":
        router.push(`/checkout/${destination.paymentId}?success=true`);
        break;
      case "checkout-url":
        window.location.href = destination.url;
        break;
      case "error":
        setError(destination.message);
        setSubmitting(false);
        break;
      case "nothing":
        break;
    }
  }

  return { data, loading, agreed, setAgreed, submitting, error, handleRegister };
}
