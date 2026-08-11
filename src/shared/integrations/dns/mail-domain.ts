import { isWellKnownMailDomain } from "@/shared/lib/email";

/**
 * "unknown" is a real answer, not a failure to produce one: the caller must let
 * the address through on it. A resolver that is slow, blocked by a network or
 * simply down must never be able to stop someone changing their email.
 */
export type MailDomainVerdict = "deliverable" | "no-mail-server" | "unknown";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const LOOKUP_TIMEOUT_MS = 3000;

const NXDOMAIN = 3;

interface DohAnswer {
  Status?: number;
  Answer?: { type: number; data: string }[];
}

async function resolve(domain: string, type: "MX" | "A"): Promise<DohAnswer | null> {
  try {
    const res = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as DohAnswer) : null;
  } catch {
    return null;
  }
}

/**
 * Whether mail can reach a domain at all, over DNS-over-HTTPS so it works the
 * same in a browser and in an isolate.
 *
 * This answers for the domain, never for the mailbox — no check short of
 * sending can tell you that, which is what the confirmation link is for. It is
 * here to catch a mistyped domain before a message is sent to it.
 */
export async function checkMailDomain(domain: string): Promise<MailDomainVerdict> {
  // The list is there precisely so the addresses most people type cost nothing
  // to accept.
  if (isWellKnownMailDomain(domain)) return "deliverable";

  const mx = await resolve(domain, "MX");
  if (!mx) return "unknown";
  if (mx.Status === NXDOMAIN) return "no-mail-server";
  if (mx.Answer?.some((record) => record.type === 15)) return "deliverable";

  // A domain with no MX still receives mail at its address record — RFC 5321
  // treats that as an implicit exchanger — so rejecting on a missing MX alone
  // would turn away small domains that work perfectly well.
  const a = await resolve(domain, "A");
  if (!a) return "unknown";
  if (a.Answer?.some((record) => record.type === 1)) return "deliverable";

  return a.Status === undefined ? "unknown" : "no-mail-server";
}
