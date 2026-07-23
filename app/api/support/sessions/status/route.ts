import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ active: false });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).maybeSingle();
  if (!dbUser) {
    return NextResponse.json({ active: false });
  }

  const { data: session } = await supabase
    .from("SUPPORT_SESSIONS")
    .select("session_id")
    .eq("user_id", dbUser.user_id)
    .eq("status", "active")
    .maybeSingle();

  return NextResponse.json({ active: !!session });
}
