import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, chatDao } from "@/lib/db/dao";

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { messageId } = await params;
  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await chatDao.updateMessage(supabase, Number(messageId), {
    deleted_at: new Date().toISOString(),
  });

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
