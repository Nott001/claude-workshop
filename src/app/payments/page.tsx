"use client";

import { usePayments } from "@/modules/commerce/lib/use-payments";

export default function PaymentsPage() {
  const { payments, loading, error } = usePayments();

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
              <tr key={payment.id}>
                <td>{payment.EVENT?.title ?? "Unknown"}</td>
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
