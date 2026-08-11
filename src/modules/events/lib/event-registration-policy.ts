export type PaymentDestination =
  | { kind: "checkout"; paymentId: number }
  | { kind: "checkout-url"; url: string }
  | { kind: "error"; message: string }
  | { kind: "nothing" };

/**
 * Decide where a registration goes next from the payment-init response. The
 * two flows diverge on purpose: a provider hands back its own hosted checkout
 * URL (an external redirect the client performs), while a flow with no URL
 * falls back to the internal checkout page that polls the payment id. A
 * non-ok answer only carries an error message.
 */
export function paymentDestination(body: unknown, options: { pending: boolean; ok: boolean }): PaymentDestination {
  const { payment_id, checkout_url, error } = (body ?? {}) as {
    payment_id?: number;
    checkout_url?: string;
    error?: string;
  };

  if (!options.ok) return { kind: "error", message: error ?? "Failed to initiate payment" };
  if (typeof checkout_url === "string" && checkout_url.length > 0) return { kind: "checkout-url", url: checkout_url };
  if (typeof payment_id === "number") return { kind: "checkout", paymentId: payment_id };
  if (options.pending) return { kind: "error", message: error ?? "Failed to process payment" };
  return { kind: "nothing" };
}
