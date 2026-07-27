import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { eventDao } from "@/lib/db/dao";
import {
  uploadToStorage,
  buildEventImagePath,
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
} from "@/lib/storage";

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const eventId = formData.get("event_id") as string | null;

  if (!file || !eventId) {
    return NextResponse.json({ error: "file and event_id are required" }, { status: 400 });
  }

  if (!validateFileType("event_images", file.type)) {
    return NextResponse.json({ error: "Only JPEG and PNG images are allowed" }, { status: 400 });
  }

  if (!validateFileSize("event_images", file.size)) {
    return NextResponse.json({ error: "File size must be under 50 MB" }, { status: 400 });
  }

  const ext = getExtensionFromMimeType(file.type);
  const path = buildEventImagePath(Number(eventId), ext);

  try {
    const result = await uploadToStorage("event_images", path, file);

    const supabase = getServiceClient();
    const ok = await eventDao.updateField(supabase, Number(eventId), "cover_image_url", result.url);

    if (!ok) {
      return NextResponse.json({ error: "Failed to update event cover image" }, { status: 500 });
    }

    return NextResponse.json({ url: result.url, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
