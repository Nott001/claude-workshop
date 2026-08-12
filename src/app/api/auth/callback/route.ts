import { NextResponse } from "next/server";
import { getRouteClient } from "@/shared/db/route-client";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { syncEmailFromAuth } from "@/modules/auth/lib/sync-email";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await getRouteClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The exchange is the moment a claimed address becomes the account's
      // own, so the app row is caught up here rather than when the change was
      // asked for. Caught rather than propagated: the auth identity has
      // already moved by now, so failing the redirect would strand the account
      // between two addresses over a write the next exchange will retry.
      try {
        await syncEmailFromAuth(data?.user?.id, data?.user?.email);
      } catch (err) {
        console.error("Mirroring the confirmed email onto the user row failed:", err);
      }
      return NextResponse.redirect(`${origin}/email-verified${redirectUrlParam(searchParams.get("redirect_url"))}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
