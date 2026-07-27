import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { speakerDao, userDao } from "@/lib/db/dao";
import { speakerProfileUpdateSchema } from "@/modules/event-management";
import { deleteFromStorage } from "@/lib/storage";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator", "speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
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

  const { userId: clerkId } = await auth();
  const caller = await userDao.findByAuthIdWithRole(supabase, clerkId!);

  if (caller && caller.role !== "facilitator" && caller.id !== profile.user_id) {
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
    return NextResponse.json({ error: guard.error }, { status: 401 });
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
