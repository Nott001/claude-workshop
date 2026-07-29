import { NextResponse } from "next/server";
import { getCurrentUserId, requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { userDao } from "@/shared/db/dao";

export async function GET() {
  const user = await requireAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    role: user.role,
    full_name: user.full_name,
    email: user.email,
    profile_image_url: user.profile_image_url,
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

  const body: { full_name?: string; email?: string; profile_image_url?: string | null } = await req.json();

  const supabase = getServiceClient();
  const updated = await userDao.updateUser(supabase, authUserId, body);

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    full_name: updated.full_name,
    email: updated.email,
    profile_image_url: updated.profile_image_url,
  });
}
