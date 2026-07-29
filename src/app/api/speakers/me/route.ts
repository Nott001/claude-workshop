import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { speakerDao } from "@/shared/db/dao";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import type { UserRole } from "@/shared/types";

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

export async function POST(req: Request) {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!hasMinRole(user.role as UserRole, "speaker")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await speakerDao.findByUserId(supabase, user.id);
  if (existing) {
    return NextResponse.json({ error: "Speaker profile already exists" }, { status: 409 });
  }

  const body = await req.json();
  const { designation, bio } = body;

  const profile = await speakerDao.create(supabase, {
    user_id: user.id,
    designation: designation ?? null,
    bio: bio ?? null,
  });

  if (!profile) {
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: profile.id }, { status: 201 });
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
