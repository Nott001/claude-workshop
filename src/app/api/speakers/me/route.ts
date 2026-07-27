import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { speakerDao } from "@/lib/db/dao";

export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const profile = await speakerDao.findByUserId(supabase, user.id);

  if (!profile) {
    return NextResponse.json({
      speaker_profile_id: null,
      full_name: user.full_name,
      email: user.email,
      bio: null,
      designation: null,
      photo_url: null,
    });
  }

  return NextResponse.json({
    ...profile,
    full_name: user.full_name,
    email: user.email,
  });
}

export async function PATCH(req: Request) {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const profile = await speakerDao.findByUserId(supabase, user.id);

  if (!profile) {
    return NextResponse.json({ error: "No speaker profile" }, { status: 404 });
  }

  const body = await req.json();
  const { designation, bio } = body;

  const updated = await speakerDao.update(supabase, profile.id, { designation: designation ?? null, bio: bio ?? null });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
