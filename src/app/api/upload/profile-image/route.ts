import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import { uploadToStorage, listStorageFolder, deleteFromStorage } from "@/shared/integrations/storage/service";
import {
  buildProfileImagePath,
  validateFileType,
  validateFileSize,
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

  if (!validateFileSize("profile_images", file.size)) {
    return NextResponse.json({ error: "File size must be under 50 MB" }, { status: 400 });
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
