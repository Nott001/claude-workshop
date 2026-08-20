import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { speakerProfileSchema } from "@/modules/events/lib/schemas";
import { badRequest } from "@/shared/lib/api-response";

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();

  const { searchParams } = new URL(req.url);
  const options = {
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
  };
  const profiles =
    searchParams.get("role") === ROLES.SPEAKER
      ? await speakerDao.listCandidates(supabase, options)
      : await speakerDao.list(supabase, options);

  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = speakerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();
  const profile = await speakerDao.create(supabase, {
    user_id: parsed.data.user_id,
    bio: parsed.data.bio ?? null,
    designation: parsed.data.designation ?? null,
  });

  if (!profile) {
    return NextResponse.json({ error: "Failed to create speaker profile" }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
