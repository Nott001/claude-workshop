const FALLBACK = "http://localhost:3000";

/**
 * NEXT_PUBLIC_APP_URL is hand-entered configuration, so it may or may not carry
 * a trailing slash — the deployed value does, which once produced
 * `//checkout/123`. Normalising in one place keeps every caller from having to
 * know that.
 */
export function appBaseUrl(appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  return (appUrl?.trim() || FALLBACK).replace(/\/+$/, "");
}
