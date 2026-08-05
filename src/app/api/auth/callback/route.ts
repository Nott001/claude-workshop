import { NextResponse } from "next/server";
import { getRouteClient } from "@/shared/db/route-client";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await getRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/email-verified`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
