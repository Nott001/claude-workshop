import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { requestPasswordReset } from "@/modules/auth/lib/password-reset";

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

  await requestPasswordReset(getServiceClient(), email, ip);

  return accepted();
}

/** One response for every path, so timing is the only signal left to equalise. */
function accepted(): NextResponse {
  return NextResponse.json({ ok: true });
}
