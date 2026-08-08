import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import * as supportSessionDao from "@/shared/db/dao/support-session.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const message = await chatDao.findMessageWithUser(supabase, Number(messageId));
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Either side of the conversation may clear their own messages; otherwise
  // only admin+ or the facilitator assigned to the case.
  const participant = message.user_id === user.id || message.recipient_user_id === user.id;
  if (!participant && !hasMinRole(user.role, ROLES.ADMIN)) {
    const session = message.session_id ? await supportSessionDao.findById(supabase, message.session_id) : null;
    if (!session || session.assigned_to !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ok = await chatDao.updateMessage(supabase, Number(messageId), {
    deleted_at: new Date().toISOString(),
  });

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
