import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { messageId } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("CHAT_MESSAGES")
    .update({ deleted_at: new Date().toISOString() })
    .eq("message_id", Number(messageId))
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
