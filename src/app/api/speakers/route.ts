import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { speakerDao } from "@/lib/db/dao";
import { speakerProfileSchema } from "@/modules/event-management";

export async function GET() {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();

  const profiles = await speakerDao.list(supabase);

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
  const profile = await speakerDao.create(supabase, {
    user_id: parsed.data.user_id,
    bio: parsed.data.bio ?? null,
    photo_url: parsed.data.photo_url ?? null,
    designation: parsed.data.designation ?? null,
  });

  if (!profile) {
    return NextResponse.json({ error: "Failed to create speaker profile" }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
