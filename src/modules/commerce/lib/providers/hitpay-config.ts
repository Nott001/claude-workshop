/**
 * Secrets the HitPay adapter needs, read out of the environment rather than
 * config/payments.yaml — same rule as SMTP: never name these NEXT_PUBLIC_*,
 * the Next compiler would inline them into the client bundle.
 */
export interface HitPayCredentials {
  apiKey: string;
  salt: string;
}

export const HITPAY_BASE_URLS = {
  sandbox: "https://api.sandbox.hit-pay.com/v1",
  production: "https://api.hit-pay.com/v1",
} as const;

export type HitPayEnvironment = keyof typeof HITPAY_BASE_URLS;

/**
 * Returns null when the account is not configured rather than throwing, so
 * local dev keeps working on the simulated provider while the key stays unset.
 * A payment request against a missing key would fail at the network anyway;
 * failing earlier with a clear message beats a 403 from HitPay.
 */
export function readHitPayConfig(env: Record<string, string | undefined> = process.env): HitPayCredentials | null {
  const apiKey = env.HITPAY_API_KEY?.trim();
  const salt = env.HITPAY_SALT?.trim();

  if (!apiKey || !salt) return null;

  return { apiKey, salt };
}
