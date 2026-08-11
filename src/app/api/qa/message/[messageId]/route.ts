import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";

export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Reading is open to any authenticated user, like the module listing; only
  // deletion is moderated. A panel fetches a question it just received a
  // realtime INSERT for, and those may belong to other attendees.
  const message = await chatDao.qaMessageDao.findByIdWithUser(supabase, Number(messageId));
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json(message);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const message = await chatDao.qaMessageDao.findById(supabase, Number(messageId));
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // The asker may always take their own question down; anyone else must be on
  // the course's team (admin+, or a facilitator/speaker assigned to its event).
  if (message.user_id !== user.id) {
    const denied = await requireModuleAccess(message.module_id, user.id, user.role);
    if (denied) {
      return denied;
    }
  }

  const ok = await chatDao.qaMessageDao.softDelete(supabase, [Number(messageId)]);
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
