import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { speakerProfileSchema } from "@/modules/event-management";

export async function GET() {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: profiles, error } = await supabase
    .from("SPEAKER_PROFILES")
    .select("*, USERS(full_name, email)")
    .order("speaker_profile_id", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const body = await req.json();
  const parsed = speakerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: profile, error } = await supabase
    .from("SPEAKER_PROFILES")
    .insert({
      user_id: parsed.data.user_id,
      bio: parsed.data.bio ?? null,
      photo_url: parsed.data.photo_url ?? null,
      designation: parsed.data.designation ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
