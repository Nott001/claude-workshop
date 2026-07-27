import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, speakerDao } from "@/lib/db/dao";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthId(supabase, userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = await speakerDao.findByUserId(supabase, dbUser.id);

  if (!profile) {
    return NextResponse.json({
      speaker_profile_id: null,
      full_name: dbUser.full_name,
      email: dbUser.email,
      bio: null,
      designation: null,
      photo_url: null,
    });
  }

  return NextResponse.json({
    ...profile,
    full_name: dbUser.full_name,
    email: dbUser.email,
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthId(supabase, userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = await speakerDao.findByUserId(supabase, dbUser.id);

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
