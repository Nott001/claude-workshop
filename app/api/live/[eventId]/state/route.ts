import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const { userId } = await auth();
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("event_id")
    .eq("event_id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (existing) {
    const { error: resetError } = await supabase
      .from("LIVE_SESSION_STATE")
      .update({
        current_lesson_id: null,
        session_status: "scheduled",
        updated_by: dbUser.user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", id);

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "reset" });
  }

  const { error: insertError } = await supabase.from("LIVE_SESSION_STATE").insert({
    event_id: Number(id),
    current_lesson_id: null,
    session_status: "live",
    updated_by: dbUser.user_id,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "started" }, { status: 201 });
}
