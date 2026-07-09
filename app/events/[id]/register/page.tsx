"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

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

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const eventId = params.id as string;
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

  if (loading) return <div>Loading...</div>;
  if (error || !data) return <div>{error ?? "Not found"}</div>;

  if (data.already_registered) {
    return (
      <div>
        <h1>Already Registered</h1>
        <p>You already have a ticket for {data.event.title}.</p>
        <button onClick={() => router.push("/tickets")}>View My Tickets</button>
      </div>
    );
  }

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

    const payRes = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: Number(eventId) }),
    });

    if (!payRes.ok) {
      const body = await payRes.json();
      setError(body.error ?? "Failed to initiate payment");
      setSubmitting(false);
      return;
    }

    const { payment_id } = await payRes.json();
    router.push(`/checkout/${payment_id}`);
  }

  return (
    <div>
      <button onClick={() => router.push(`/events/${eventId}`)}>&larr; Back to Event</button>

      <h1>Register for {data.event.title}</h1>

      <div>
        <p>{data.event.event_date}</p>
        <p>
          {data.event.start_time} - {data.event.end_time}
        </p>
        <p>{data.event.venue_name}</p>
      </div>

      <div>
        <h2>Your Information</h2>
        <p>Name: {data.user.full_name}</p>
        <p>Email: {data.user.email}</p>
      </div>

      {error && <p>{error}</p>}

      <label>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I agree to the terms and
        conditions
      </label>

      <button disabled={!agreed || submitting} onClick={handleRegister}>
        {submitting ? "Processing..." : "Proceed to Payment"}
      </button>
    </div>
  );
}
