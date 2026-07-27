"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { formatEventDate, formatTime } from "@/lib/landing";
import { Footer } from "@/components/footer";

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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">Not found</div>
      </div>
    );
  }

  if (data.already_registered) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="mx-auto max-w-sm text-center">
          <span className="material-symbols-rounded text-4xl text-info">confirmation_number</span>
          <h1 className="mt-4 text-lg font-bold text-foreground">Already Registered</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You already have a ticket for <strong className="text-foreground">{data.event.title}</strong>.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => router.push("/tickets")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-rounded text-sm">confirmation_number</span>
              View my tickets
            </button>
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
            >
              Back to event
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="mx-auto w-full max-w-lg">
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-sm">arrow_back</span>
            Back to event
          </button>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)]">
            <div className="relative bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300 p-6 text-white">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                  <span className="material-symbols-rounded text-[14px]">how_to_reg</span>
                  Registration
                </span>
                <h1 className="mt-3 text-lg font-bold">{data.event.title}</h1>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">calendar_today</span>
                  {formatEventDate(data.event.event_date)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">schedule</span>
                  {formatTime(data.event.start_time)} – {formatTime(data.event.end_time)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-base text-info">location_on</span>
                  {data.event.venue_name}
                </p>
              </div>

              <div className="border-t border-border pt-6">
                <h2 className="text-sm font-semibold text-foreground">Your Information</h2>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-sm text-muted-foreground">person</span>
                    <span className="text-sm text-foreground">{data.user.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-sm text-muted-foreground">mail</span>
                    <span className="text-sm text-foreground">{data.user.email}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
              )}

              <div className="border-t border-border pt-6">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-border text-info focus:ring-info"
                  />
                  <span className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <button className="font-medium text-info underline underline-offset-2 hover:text-info">
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button className="font-medium text-info underline underline-offset-2 hover:text-info">
                      Privacy Policy
                    </button>
                  </span>
                </label>
              </div>

              <button
                disabled={!agreed || submitting}
                onClick={handleRegister}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-info/100 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-rounded text-sm">{submitting ? "progress_activity" : "how_to_reg"}</span>
                {submitting ? "Processing..." : "Proceed to Payment"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer role="attendee" />
    </>
  );
}
