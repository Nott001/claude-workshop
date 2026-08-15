import { NextResponse } from "next/server";
import { getRouteClient } from "@/shared/db/route-client";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { syncEmailFromAuth } from "@/modules/auth/lib/sync-email";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const authFailed = () => NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);

  const supabase = await getRouteClient();

  // A callback carrying no code has nothing to redeem, so it is never sent to
  // Supabase. That absence is folded into the same result the exchange returns
  // rather than tested in an `if` of its own: a missing code and a rejected one
  // are the same outcome to every line below, and collapsing them leaves one
  // failure branch to reason about instead of two that must agree.
  const redeemed = code ? await supabase.auth.exchangeCodeForSession(code) : null;
  if (!redeemed || redeemed.error) return authFailed();

  // Supabase has validated the code by this point, so the identity below comes
  // from the session it issued rather than from the request. The mirror is
  // keyed off that identity for the same reason.
  const confirmed = redeemed.data?.user;
  if (confirmed) {
    // The exchange is the moment a claimed address becomes the account's own,
    // so the app row is caught up here rather than when the change was asked
    // for. Caught rather than propagated: the auth identity has already moved
    // by now, so failing the redirect would strand the account between two
    // addresses over a write the next exchange will retry.
    try {
      await syncEmailFromAuth(confirmed.id, confirmed.email);
    } catch (err) {
      console.error("Mirroring the confirmed email onto the user row failed:", err);
    }
  }

  return NextResponse.redirect(`${origin}/email-verified${redirectUrlParam(searchParams.get("redirect_url"))}`);
}
