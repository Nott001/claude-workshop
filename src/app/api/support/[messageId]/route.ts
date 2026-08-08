import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, ROLES.FACILITATOR)) {
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
