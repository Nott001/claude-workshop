import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, full_name, email").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("SPEAKER_PROFILES")
    .select("speaker_profile_id, bio, designation, photo_url")
    .eq("user_id", dbUser.user_id)
    .single();

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

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("SPEAKER_PROFILES")
    .select("speaker_profile_id")
    .eq("user_id", dbUser.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No speaker profile" }, { status: 404 });
  }

  const body = await req.json();
  const { designation, bio } = body;

  const { error } = await supabase
    .from("SPEAKER_PROFILES")
    .update({ designation: designation ?? null, bio: bio ?? null })
    .eq("speaker_profile_id", profile.speaker_profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
