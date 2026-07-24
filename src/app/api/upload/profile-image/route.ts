import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import {
  uploadToStorage,
  buildProfileImagePath,
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
  listStorageFolder,
  deleteFromStorage,
} from "@/lib/storage";

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

  const { userId: clerkId } = await auth();
  const supabase = getServiceClient();

  const { data: user } = await supabase.from("USERS").select("user_id").eq("clerk_id", clerkId).single();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ext = getExtensionFromMimeType(file.type);
  const path = buildProfileImagePath(user.user_id, ext);

  try {
    const oldPaths = await listStorageFolder("profile_images", `users/${user.user_id}`);
    if (oldPaths.length > 0) {
      await deleteFromStorage("profile_images", oldPaths);
    }

    const result = await uploadToStorage("profile_images", path, file);

    const { error } = await supabase
      .from("SPEAKER_PROFILES")
      .upsert({ user_id: user.user_id, photo_url: result.url }, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ url: result.url, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
