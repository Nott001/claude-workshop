import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { speakerProfileUpdateSchema } from "@/modules/event-management";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator", "speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = speakerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: profile } = await supabase.from("SPEAKER_PROFILES").select("user_id").eq("speaker_profile_id", id).single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { userId: clerkId } = await auth();
  const { data: caller } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", clerkId).single();

  if (caller && caller.role !== "facilitator" && caller.user_id !== profile.user_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from("SPEAKER_PROFILES")
    .update(parsed.data)
    .eq("speaker_profile_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { error } = await supabase.from("SPEAKER_PROFILES").delete().eq("speaker_profile_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
