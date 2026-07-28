import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { chatDao } from "@/shared/db/dao";

const CHANNEL = "support" as const;

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
