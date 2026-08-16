import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { uploadToStorage, listStorageFolder, deleteFromStorage } from "@/shared/integrations/storage/service";
import {
  buildProfileImagePath,
  validateFileType,
  validateFileSize,
  oversizeMessage,
  getExtensionFromMimeType,
} from "@/shared/integrations/storage/policy";

export async function POST(req: Request) {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const authUserId = await getCurrentUserId();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!validateFileType("profile_images", file.type)) {
    return NextResponse.json({ error: "Only JPEG and PNG images are allowed" }, { status: 400 });
  }

  // Measured after the browser's resize, so this is the bound on what the
  // isolate holds -- not the size the reader was offered.
  if (!validateFileSize("profile_images", file.size)) {
    return NextResponse.json({ error: oversizeMessage("profile_images") }, { status: 400 });
  }

  const supabase = getServiceClient();

  const ext = getExtensionFromMimeType(file.type);
  const path = buildProfileImagePath(guard.user.id, ext);

  try {
    const oldPaths = await listStorageFolder("profile_images", `users/${guard.user.id}`);
    if (oldPaths.length > 0) {
      await deleteFromStorage("profile_images", oldPaths);
    }

    const result = await uploadToStorage("profile_images", path, file);

    await userDao.updateUser(supabase, authUserId, { profile_image_url: result.url });

    return NextResponse.json({ url: result.url, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const authUserId = await getCurrentUserId();
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  try {
    const oldPaths = await listStorageFolder("profile_images", `users/${guard.user.id}`);
    await deleteFromStorage("profile_images", oldPaths);

    await userDao.updateUser(supabase, authUserId, { profile_image_url: null });

    // The speaker profile can carry a photo_url fallback that the avatar shows
    // when the user row has no image; clearing only the user row would let the
    // old picture survive the delete through that fallback.
    if (guard.user.role === ROLES.SPEAKER) {
      const profile = await speakerDao.findByUserId(supabase, guard.user.id);
      if (profile) {
        await speakerDao.update(supabase, profile.id, { photo_url: null });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
