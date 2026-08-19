import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { addEventPhoto, EventServiceError, listEventPhotos } from "@/modules/events/lib/event-service";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import type { UserRole } from "@/shared/types";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

/** The archive of one event. Public for a published event — the gallery renders
 *  on a detail page a visitor with no session can already read. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);

  try {
    const photos = await listEventPhotos(supabase, Number(id), (user?.role as UserRole | undefined) ?? null);
    return NextResponse.json({ data: photos });
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const photo = await addEventPhoto(supabase, Number(id), { id: user.id, role: user.role as UserRole }, file);

    await requireAuditEvent(supabase, user.id, "event.photo_added", "event", Number(id), { photo_id: photo.id });

    // `url` beside the row because every upload endpoint answers with one, and
    // `postUpload` reads that key — the row's own name for it is `image_url`.
    return NextResponse.json({ ...photo, url: photo.image_url }, { status: 201 });
  } catch (err) {
    return mapError(err);
  }
}
