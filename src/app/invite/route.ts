import { NextResponse } from "next/server";
import { appBaseUrl } from "@/shared/lib/app-url";

/** Supabase's hashed_token: opaque, but always URL-safe and of bounded length. */
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Fronts Supabase's verification endpoint on our own domain.
 *
 * The invitation email is sent from `no-reply@startuplab.center`, and a message
 * whose only link points somewhere else entirely is the shape of a phishing
 * attempt — which spam filters weight heavily. Pointing the link here keeps the
 * visible address on the same origin as the rest of the application.
 *
 * Deliberately not an open redirect: the destination and the post-verification
 * return address are both built from configuration, and the token is the only
 * caller-supplied value.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token");

  if (!token || !TOKEN.test(token)) {
    return NextResponse.redirect(`${appBaseUrl()}/sign-in?error=invalid_invite`, 302);
  }

  const verify = new URL("/auth/v1/verify", process.env.NEXT_PUBLIC_SUPABASE_URL);
  verify.searchParams.set("token", token);
  verify.searchParams.set("type", "invite");
  verify.searchParams.set("redirect_to", `${appBaseUrl()}/api/auth/callback`);

  return NextResponse.redirect(verify, 302);
}
