"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const paymentId = params.paymentId as string;
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    let cancelled = false;

    async function checkPayment() {
      for (let i = 0; i < 30; i++) {
        if (cancelled) return;

        const res = await fetch(`/api/payments/${paymentId}`);
        if (!res.ok) {
          if (!cancelled) setError("Failed to check payment status");
          return;
        }

        const data = await res.json();

        if (cancelled) return;
        setStatus(data.status);

        if (data.status === "paid") {
          router.push("/tickets");
          return;
        }

        if (data.status === "failed") {
          setError("Payment failed. Please try again.");
          return;
        }

        await new Promise((r) => setTimeout(r, 1500));
      }

      if (!cancelled) {
        setError("Payment is taking longer than expected. Check your tickets later.");
      }
    }

    checkPayment();

    return () => {
      cancelled = true;
    };
  }, [paymentId, isLoaded, isSignedIn, router]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="mx-auto max-w-sm text-center">
          <span className="material-symbols-rounded text-4xl text-error">error</span>
          <h1 className="mt-4 text-lg font-bold text-foreground">Payment Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-rounded text-sm">refresh</span>
              Try again
            </button>
            <button
              onClick={() => router.push("/tickets")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
            >
              View my tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="mx-auto max-w-sm text-center">
        <span className="material-symbols-rounded text-4xl text-info">
          {status === "loading" ? "hourglass_top" : "progress_activity"}
        </span>
        <h1 className="mt-4 text-lg font-bold text-foreground">
          {status === "paid" ? "Payment Confirmed" : "Processing Payment"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "loading"
            ? "Checking payment status..."
            : status === "paid"
              ? "Redirecting to your tickets..."
              : "Waiting for payment confirmation..."}
        </p>
        {status !== "loading" && status !== "paid" && (
          <p className="mt-4 text-xs text-muted-foreground">
            Status: <span className="font-medium capitalize">{status}</span>
          </p>
        )}
      </div>
    </div>
  );
}
