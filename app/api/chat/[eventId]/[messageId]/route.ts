import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id, messageId } = await params;
  const supabase = getServiceClient();

  const { data: message } = await supabase
    .from("CHAT_MESSAGES")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("event_id", id)
    .single();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("CHAT_MESSAGES")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("message_id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
