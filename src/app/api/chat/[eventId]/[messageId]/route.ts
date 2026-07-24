import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string; messageId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { eventId, messageId } = await params;
  const body = await req.json();
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (dbUser.role !== "facilitator" && dbUser.role !== "speaker") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: message } = await supabase
    .from("CHAT_MESSAGES")
    .select("message_id, event_id")
    .eq("message_id", messageId)
    .eq("event_id", eventId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const updates: Record<string, string | boolean> = { updated_at: new Date().toISOString() };

  if (body.answered_verbally !== undefined) {
    updates.answered_verbally = body.answered_verbally;
  }

  const { error } = await supabase.from("CHAT_MESSAGES").update(updates).eq("message_id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { data: message } = await supabase
    .from("CHAT_MESSAGES")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("event_id", eventId)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const idsToDelete = [messageId];

  const { data: replies } = await supabase
    .from("CHAT_MESSAGES")
    .select("message_id")
    .eq("reply_to", messageId)
    .eq("event_id", eventId);

  if (replies) {
    for (const reply of replies) {
      idsToDelete.push(reply.message_id);
    }
  }

  const { error } = await supabase
    .from("CHAT_MESSAGES")
    .update({ deleted_at: now, updated_at: now })
    .in("message_id", idsToDelete);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
