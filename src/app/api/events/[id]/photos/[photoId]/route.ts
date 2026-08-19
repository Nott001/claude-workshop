import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, removeEventPhoto, updateEventPhotoCaption } from "@/modules/events/lib/event-service";
import { eventPhotoCaptionSchema } from "@/modules/events/lib/schemas";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { badRequest } from "@/shared/lib/api-response";
import type { UserRole } from "@/shared/types";
import { unauthenticated } from "@/modules/auth/lib/guard-response";

type RouteParams = { params: Promise<{ id: string; photoId: string }> };

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id, photoId } = await params;
  const supabase = getServiceClient();

  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthenticated();
  }

  const parsed = eventPhotoCaptionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  try {
    const photo = await updateEventPhotoCaption(
      supabase,
      Number(id),
      Number(photoId),
      { id: user.id, role: user.role as UserRole },
      parsed.data.caption,
    );
    return NextResponse.json(photo);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id, photoId } = await params;
  const supabase = getServiceClient();

  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthenticated();
  }

  try {
    await removeEventPhoto(supabase, Number(id), Number(photoId), { id: user.id, role: user.role as UserRole });

    await requireAuditEvent(supabase, user.id, "event.photo_removed", "event", Number(id), {
      photo_id: Number(photoId),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
