import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { speakerProfileUpdateSchema } from "@/modules/events/lib/schemas";
import { deleteFromStorage } from "@/shared/integrations/storage/service";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator", "speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = speakerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const profile = await speakerDao.findById(supabase, Number(id));

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!hasMinRole(guard.user.role, "facilitator") && guard.user.id !== (profile as { user_id: number }).user_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await speakerDao.update(supabase, Number(id), parsed.data);

  if (!updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const profile = await speakerDao.findById(supabase, Number(id));

  if ((profile as { photo_url?: string | null } | null)?.photo_url) {
    const { data: userFiles } = await supabase.storage.from("profile_images").list(`users/${profile!.user_id}`);
    const paths = (userFiles ?? []).map((f) => `users/${profile!.user_id}/${f.name}`);
    await deleteFromStorage("profile_images", paths);
  }

  const ok = await speakerDao.remove(supabase, Number(id));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete speaker profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
