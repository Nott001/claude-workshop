import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUserId, requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { isSameEmail } from "@/shared/lib/email";
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
    linkedin_url: profile?.linkedin_url ?? null,
    twitter_url: profile?.twitter_url ?? null,
    github_url: profile?.github_url ?? null,
    website_url: profile?.website_url ?? null,
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
    linkedin_url?: string | null;
    twitter_url?: string | null;
    github_url?: string | null;
    website_url?: string | null;
  } = await req.json();

  // A speaker profile is the user's own row, so it lives on the same route —
  // but only a speaker may write it. The exact role is required, not a minimum,
  // because facilitators and admins carry no speaker bio. Guard before touching
  // anything so a rejected caller never leaves half a profile updated.
  const wantsSpeakerUpdate =
    body.designation !== undefined ||
    body.bio !== undefined ||
    body.linkedin_url !== undefined ||
    body.twitter_url !== undefined ||
    body.github_url !== undefined ||
    body.website_url !== undefined;
  if (wantsSpeakerUpdate && guard.role !== ROLES.SPEAKER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Re-submitting the address already on the account is refused here and not
  // only in the form, because the write that follows is what makes the app row
  // disagree with the auth identity: it would stamp a change that never
  // happened over a row Supabase has not been asked to move.
  if (body.email !== undefined && isSameEmail(body.email, guard.email)) {
    return NextResponse.json({ error: "New email must be different from your current email." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const updated = await userDao.updateUser(supabase, authUserId, body);

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  if (wantsSpeakerUpdate) {
    const speakerFields = {
      designation: body.designation ?? null,
      bio: body.bio ?? null,
      linkedin_url: body.linkedin_url ?? null,
      twitter_url: body.twitter_url ?? null,
      github_url: body.github_url ?? null,
      website_url: body.website_url ?? null,
    };
    const existing = await speakerDao.findByUserId(supabase, updated.id);
    const profile = existing
      ? await speakerDao.update(supabase, existing.id, speakerFields)
      : await speakerDao.create(supabase, { user_id: updated.id, ...speakerFields });

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
