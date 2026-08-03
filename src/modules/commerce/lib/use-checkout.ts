"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";

export function useCheckout(paymentId: string) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useSession();
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

  return { status, error };
}
