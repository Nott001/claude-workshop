import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { requestPasswordReset } from "@/modules/auth/lib/password-reset";
import { afterResponse } from "@/shared/lib/after-response";

/**
 * Requests a password reset link.
 *
 * Under /api/auth because that prefix is the one the middleware leaves open: a
 * locked-out user has no session, which is the entire point of the request.
 *
 * Always answers 200. The service reports nothing about whether the address
 * exists, was rate limited, or was mailed, and this route must not reintroduce
 * the distinction the service was careful to remove.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return accepted();
  }

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return accepted();
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return accepted();
  }

  // Cloudflare sets this at the edge and it cannot be spoofed by the client;
  // it is absent under `next dev`, where the per-email limit still applies.
  const ip = req.headers.get("cf-connecting-ip");

  // Deferred, and this is load-bearing rather than a latency nicety. The SMTP
  // round trip takes seconds for an address that owns an account and does not
  // happen at all for one that does not, so awaiting it here would answer
  // "is this person registered" on the clock no matter what the body says.
  afterResponse(() => requestPasswordReset(getServiceClient(), email, ip));

  return accepted();
}

/**
 * One response for every path. Nothing that depends on whether the address
 * exists runs before it, so the reply is the same shape and the same speed
 * whoever asks.
 */
function accepted(): NextResponse {
  return NextResponse.json({ ok: true });
}
