import { NextResponse } from "next/server";
import { getRouteClient } from "@/shared/db/route-client";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await getRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/email-verified${redirectUrlParam(searchParams.get("redirect_url"))}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
