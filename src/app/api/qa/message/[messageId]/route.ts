import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, "speaker")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await chatDao.qaMessageDao.findById(supabase, Number(messageId));
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const ok = await chatDao.qaMessageDao.softDelete(supabase, [Number(messageId)]);
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
