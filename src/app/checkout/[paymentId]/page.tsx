"use client";

import { useParams, useRouter } from "next/navigation";
import { useCheckout } from "@/modules/commerce/lib/use-checkout";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.paymentId as string;
  const { status, error } = useCheckout(paymentId);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="mx-auto max-w-sm text-center">
          <span className="material-symbols-rounded text-4xl text-error">error</span>
          <h1 className="mt-4 text-lg font-bold text-fg">Payment Status</h1>
          <p className="mt-2 text-sm text-muted-fg">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand/90"
            >
              <span className="material-symbols-rounded text-sm">refresh</span>
              Try again
            </button>
            <button
              onClick={() => router.push("/tickets")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-muted"
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
        <h1 className="mt-4 text-lg font-bold text-fg">{status === "paid" ? "Payment Confirmed" : "Processing Payment"}</h1>
        <p className="mt-2 text-sm text-muted-fg">
          {status === "loading"
            ? "Checking payment status..."
            : status === "paid"
              ? "Redirecting to your tickets..."
              : "Waiting for payment confirmation..."}
        </p>
        {status !== "loading" && status !== "paid" && (
          <p className="mt-4 text-xs text-muted-fg">
            Status: <span className="font-medium capitalize">{status}</span>
          </p>
        )}
      </div>
    </div>
  );
}
