"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const paymentId = params.paymentId as string;
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const successParam = searchParams.get("success");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    async function pollPayment() {
      for (let i = 0; i < 30; i++) {
        const res = await fetch(`/api/payments/${paymentId}`);
        if (!res.ok) {
          setError("Failed to check payment status");
          return;
        }
        const data = await res.json();
        setStatus(data.status);

        if (data.status === "paid") {
          router.push("/tickets");
          return;
        }
        if (data.status === "failed") {
          setError("Payment failed. Please try again.");
          return;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
      setError("Payment is taking longer than expected. Check your tickets later.");
    }

    if (successParam === "true") {
      pollPayment();
    }
  }, [paymentId, successParam, isLoaded, isSignedIn, router]);

  if (error) {
    return (
      <div>
        <h1>Payment Status</h1>
        <p>{error}</p>
        <button onClick={() => router.push("/payments")}>View Payments</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Processing Payment</h1>
      <p>Status: {status}</p>
      <p>Waiting for payment confirmation...</p>
    </div>
  );
}
