import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).maybeSingle();
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: sessions, error } = await supabase
    .from("SUPPORT_SESSIONS")
    .select("*, USERS(full_name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).maybeSingle();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action ?? "end";
  const targetUserId = body.user_id ? Number(body.user_id) : dbUser.user_id;

  const isOwn = targetUserId === dbUser.user_id;
  const isFacilitator = dbUser.role === "facilitator";

  if (!isOwn && !isFacilitator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (!isOwn) {
      return NextResponse.json({ error: "Can only start your own session" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("SUPPORT_SESSIONS")
      .select("session_id")
      .eq("user_id", targetUserId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ session: existing });
    }

    const { data: session, error } = await supabase
      .from("SUPPORT_SESSIONS")
      .insert({ user_id: targetUserId })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session });
  }

  const { data: session, error } = await supabase
    .from("SUPPORT_SESSIONS")
    .update({ status: "ended_by_facilitator", updated_at: new Date().toISOString() })
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .select()
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: session ?? null });
}
