import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { speakerDao } from "@/shared/db/dao";
import {
  uploadToStorage,
  buildProfileImagePath,
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
  listStorageFolder,
  deleteFromStorage,
} from "@/shared/integrations/storage";

export async function POST(req: Request) {
  const guard = await requireRole("facilitator", "speaker", "attendee");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
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

    const existing = await speakerDao.findByUserId(supabase, guard.user.id);
    if (existing) {
      await speakerDao.update(supabase, existing.id, { photo_url: result.url });
    } else {
      await speakerDao.create(supabase, { user_id: guard.user.id, photo_url: result.url });
    }

    return NextResponse.json({ url: result.url, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
