import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { preparePasswordReset, type RecoverStatus } from "@/modules/auth/lib/password-reset";
import { afterResponse } from "@/shared/lib/after-response";

/**
 * Requests a password reset link.
 *
 * Under /api/auth because that prefix is the one the middleware leaves open: a
 * locked-out user has no session, which is the entire point of the request.
 *
 * This route reports whether the address owns an account, which makes it an
 * enumeration oracle by design — a caller can ask it who is registered. The
 * per-IP limit in `preparePasswordReset` is what keeps that from scaling to a
 * mailbox list, so it is applied before the lookup rather than after.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return answer("invalid_request");
  }

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return answer("invalid_request");
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return answer("invalid_request");
  }

  // Cloudflare sets this at the edge and it cannot be spoofed by the client;
  // it is absent under `next dev`, where the per-email limit still applies.
  const ip = req.headers.get("cf-connecting-ip");

  const outcome = await preparePasswordReset(getServiceClient(), email, ip);

  if (outcome.status !== "ready") return answer(outcome.status);

  // Deferred so the several-second SMTP session does not hold up the reply. The
  // address has already been confirmed to exist by this point, so nothing the
  // browser is told depends on how long this takes.
  afterResponse(outcome.deliver);

  return answer("sent");
}

function answer(status: RecoverStatus): NextResponse {
  return NextResponse.json({ status });
}
