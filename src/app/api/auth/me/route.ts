import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUserId, requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import type { SpeakerProfile } from "@/shared/types";

export async function GET() {
  const user = await requireAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const profile = await speakerDao.findByUserId(supabase, user.id);

  return NextResponse.json({
    ...user,
    speaker_profile_id: profile?.id ?? null,
    designation: profile?.designation ?? null,
    bio: profile?.bio ?? null,
    photo_url: (profile as (SpeakerProfile & { photo_url?: string | null }) | null)?.photo_url ?? null,
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAuth();
  if (!guard) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const authUserId = await getCurrentUserId();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body: {
    full_name?: string;
    email?: string;
    profile_image_url?: string | null;
    designation?: string | null;
    bio?: string | null;
  } = await req.json();

  // A speaker profile is the user's own row, so it lives on the same route —
  // but only a speaker may write it. The exact role is required, not a minimum,
  // because facilitators and admins carry no speaker bio. Guard before touching
  // anything so a rejected caller never leaves half a profile updated.
  const wantsSpeakerUpdate = body.designation !== undefined || body.bio !== undefined;
  if (wantsSpeakerUpdate && guard.role !== ROLES.SPEAKER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServiceClient();
  const updated = await userDao.updateUser(supabase, authUserId, body);

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  if (wantsSpeakerUpdate) {
    const designation = body.designation ?? null;
    const bio = body.bio ?? null;
    const existing = await speakerDao.findByUserId(supabase, updated.id);
    const profile = existing
      ? await speakerDao.update(supabase, existing.id, { designation, bio })
      : await speakerDao.create(supabase, { user_id: updated.id, designation, bio });

    if (!profile) {
      return NextResponse.json({ error: "Failed to update speaker profile" }, { status: 500 });
    }
  }

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    full_name: updated.full_name,
    email: updated.email,
    profile_image_url: updated.profile_image_url,
  });
}
