import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

const CHANNEL = "global_support" as const;

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("SUPPORT_SESSIONS").delete().eq("user_id", Number(targetUserId));

  await supabase.from("CHAT_MESSAGES").delete().eq("channel", CHANNEL).eq("user_id", Number(targetUserId));

  await supabase.from("CHAT_MESSAGES").delete().eq("channel", CHANNEL).eq("recipient_user_id", Number(targetUserId));

  return NextResponse.json({ ok: true });
}
