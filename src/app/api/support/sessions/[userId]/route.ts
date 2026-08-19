import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;
  const supabase = getServiceClient();

  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  await chatDao.deleteSession(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByUser(supabase, Number(targetUserId));

  await chatDao.deleteMessagesByRecipient(supabase, Number(targetUserId));

  return NextResponse.json({ ok: true });
}
