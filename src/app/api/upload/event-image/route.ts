import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as eventDao from "@/modules/events/db/event.dao";
import { uploadToStorage } from "@/shared/integrations/storage/service";
import {
  buildEventImagePath,
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
} from "@/shared/integrations/storage/policy";

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
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
