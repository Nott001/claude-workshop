/**
 * True for a same-origin path only — rejects absolute URLs and
 * protocol-relative ("//") input so a redirect param can never become an
 * open redirect. A type guard so callers get the narrowed string back.
 */
export function isSafeRedirectPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  return true;
}

/** `?redirect_url=…` suffix for a safe same-origin path, or "" when absent. */
export function redirectUrlParam(value: string | null | undefined): string {
  return isSafeRedirectPath(value) ? `?redirect_url=${encodeURIComponent(value)}` : "";
}
