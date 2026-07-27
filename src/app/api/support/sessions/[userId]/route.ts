import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, chatDao } from "@/lib/db/dao";

const CHANNEL = "global_support" as const;

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;
  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await chatDao.deleteSession(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByUser(supabase, Number(targetUserId), CHANNEL);

  await chatDao.deleteMessagesByRecipient(supabase, Number(targetUserId), CHANNEL);

  return NextResponse.json({ ok: true });
}
