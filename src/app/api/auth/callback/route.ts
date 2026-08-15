import { NextResponse } from "next/server";
import { getRouteClient } from "@/shared/db/route-client";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { syncEmailFromAuth } from "@/modules/auth/lib/sync-email";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const authFailed = () => NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);

  // Nothing to redeem, and nothing below is reachable without a code. Turned
  // away here rather than nested under `if (code)` so the checks that follow
  // read as what actually gates the account: the exchange, not the presence of
  // a query parameter the caller writes.
  if (!code) return authFailed();

  const supabase = await getRouteClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return authFailed();

  // Supabase has validated the code by this point, so the identity below comes
  // from the session it issued rather than from the request. The mirror is
  // keyed off that identity for the same reason.
  const confirmed = data?.user;
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
