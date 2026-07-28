import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { chatDao } from "@/shared/db/dao";

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string; messageId: string }> }) {
  const { eventId, messageId } = await params;
  const body = await req.json();
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (user.role !== "facilitator" && user.role !== "speaker") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await chatDao.findMessageById(supabase, Number(messageId), Number(eventId));

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const updates: Record<string, string | boolean> = { updated_at: new Date().toISOString() };

  if (body.answered_verbally !== undefined) {
    updates.answered_verbally = body.answered_verbally;
  }

  const ok = await chatDao.updateMessage(supabase, Number(messageId), updates);

  if (!ok) {
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string; messageId: string }> }) {
  const guard = await requireRole("facilitator", "speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { eventId, messageId } = await params;
  const supabase = getServiceClient();

  const message = await chatDao.findMessageById(supabase, Number(messageId), Number(eventId));

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const idsToDelete = [Number(messageId)];

  const replies = await chatDao.findReplies(supabase, Number(messageId), Number(eventId));
  if (replies) {
    for (const reply of replies) {
      idsToDelete.push((reply as { id: number }).id);
    }
  }

  const ok = await chatDao.softDeleteMessages(supabase, idsToDelete);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete messages" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
