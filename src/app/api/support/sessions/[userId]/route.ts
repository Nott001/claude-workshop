import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, ROLES.FACILITATOR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await chatDao.deleteSession(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByUser(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByRecipient(supabase, Number(targetUserId));

  return NextResponse.json({ ok: true });
}
