import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole, requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { speakerProfileUpdateSchema } from "@/modules/events/lib/schemas";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { AuthUser } from "@/modules/auth/lib/types";
import { badRequest } from "@/shared/lib/api-response";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Staff may edit any profile; a speaker is held to their own. Requiring both
  // exactly would lock admins out, so staff passes on min-role and only the
  // owner path is an exact-role check.
  const staff = await requireMinRole(ROLES.FACILITATOR);
  let user: AuthUser;
  if (staff.allowed) {
    user = staff.user;
  } else {
    const owner = await requireRole(ROLES.SPEAKER);
    if (!owner.allowed) {
      return guardFailure(owner);
    }
    user = owner.user;
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = speakerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();

  const profile = await speakerDao.findById(supabase, Number(id));

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!hasMinRole(user.role, ROLES.FACILITATOR) && user.id !== (profile as { user_id: number }).user_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await speakerDao.update(supabase, Number(id), parsed.data);

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const profile = await speakerDao.findById(supabase, Number(id));

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Deleting a profile wipes the speaker's history, so only admin+
  // or the owner may do it — a facilitator editing someone else's profile
  // cannot, and the profile fetch above keeps existence private below admin.
  if (!hasMinRole(guard.user.role, ROLES.ADMIN) && guard.user.id !== (profile as { user_id: number }).user_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await speakerDao.remove(supabase, Number(id));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete speaker profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
