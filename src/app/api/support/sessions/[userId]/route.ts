import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { chatDao } from "@/lib/db/dao";

const CHANNEL = "global_support" as const;

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || user.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await chatDao.deleteSession(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByUser(supabase, Number(targetUserId), CHANNEL);

  await chatDao.deleteMessagesByRecipient(supabase, Number(targetUserId), CHANNEL);

  return NextResponse.json({ ok: true });
}
