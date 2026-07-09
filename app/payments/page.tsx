"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface Payment {
  payment_id: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  EVENTS: { title: string } | null;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

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
  }, [isLoaded, isSignedIn, router]);

  if (loading) return <div>Loading payments...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Payments</h1>

      {payments.length === 0 ? (
        <p>No payments yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Created</th>
              <th>Paid At</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.payment_id}>
                <td>{payment.EVENTS?.title ?? "Unknown"}</td>
                <td>{payment.status}</td>
                <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
