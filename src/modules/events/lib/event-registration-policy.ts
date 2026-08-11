export type PaymentDestination =
  | { kind: "checkout"; paymentId: number }
  | { kind: "checkout-url"; url: string }
  | { kind: "error"; message: string }
  | { kind: "nothing" };

/**
 * Decide where a registration goes next from the payment-init response. The
 * two flows diverge on purpose: a pending payment already exists server-side,
 * so only its id matters; a fresh flow may instead hand back an external
 * checkout URL, and a non-ok answer only carries an error message.
 */
export function paymentDestination(body: unknown, options: { pending: boolean; ok: boolean }): PaymentDestination {
  const { payment_id, checkout_url, error } = (body ?? {}) as {
    payment_id?: number;
    checkout_url?: string;
    error?: string;
  };

  if (typeof payment_id === "number") return { kind: "checkout", paymentId: payment_id };
  if (options.pending) return { kind: "error", message: error ?? "Failed to process payment" };
  if (!options.ok) return { kind: "error", message: error ?? "Failed to initiate payment" };
  if (typeof checkout_url === "string") return { kind: "checkout-url", url: checkout_url };
  return { kind: "nothing" };
}
