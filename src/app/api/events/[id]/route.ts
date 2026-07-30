import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { eventDao, courseDao } from "@/shared/db/dao";
import { eventPartialSchema } from "@/modules/events/lib/schemas";
import { deleteFromStorage, listStorageFolder, type StorageBucket } from "@/shared/integrations/storage";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  const userRole = user?.role ?? null;

  const event = await eventDao.findByIdWithCourse(supabase, Number(id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft" && !hasMinRole(userRole, "facilitator")) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (hasMinRole(userRole, "facilitator")) {
    const attendeeCount = await eventDao.getAttendeeCount(supabase, Number(id));
    return NextResponse.json({ ...event, attendee_count: attendeeCount });
  }

  return NextResponse.json(event);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const event = await eventDao.update(supabase, Number(id), parsed.data);

  if (!event) {
    return NextResponse.json({ error: { message: "Failed to update event" } }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "event.updated", "event", Number(id), {
    changes: Object.keys(parsed.data),
  });

  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const event = await eventDao.findById(supabase, Number(id));

  // Collected before deletion, and kept per bucket: a path is only meaningful
  // to the bucket it was listed from, so one flat list cannot be deleted from.
  const pathsByBucket: Record<"event_images" | "course_assets" | "course_videos", string[]> = {
    event_images: [],
    course_assets: [],
    course_videos: [],
  };

  if (event?.cover_image_url) {
    pathsByBucket.event_images.push(...(await listStorageFolder("event_images", `events/${id}`)));
  }

  if (event?.id) {
    const { data: linkedCourse } = await supabase.from("COURSE").select("id").eq("event_id", event.id).maybeSingle();

    if (linkedCourse) {
      const modules = await courseDao.findModulesByCourse(supabase, linkedCourse.id);
      for (const mod of modules) {
        const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
        for (const lesson of lessons) {
          const folder = `courses/${linkedCourse.id}/modules/${mod.id}/lessons/${lesson.id}`;
          const [assetPaths, videoPaths] = await Promise.all([
            listStorageFolder("course_assets", folder),
            listStorageFolder("course_videos", folder),
          ]);
          pathsByBucket.course_assets.push(...assetPaths);
          pathsByBucket.course_videos.push(...videoPaths);
        }
      }
    }
  }

  // Delete event row first (FK cascades handle payments, tickets)
  const removed = await eventDao.remove(supabase, Number(id));

  if (!removed) {
    return NextResponse.json({ error: { message: "Failed to delete event" } }, { status: 500 });
  }

  // Best-effort storage cleanup
  try {
    await Promise.all(
      Object.entries(pathsByBucket).map(([bucket, paths]) => deleteFromStorage(bucket as StorageBucket, paths)),
    );
  } catch {
    // Storage cleanup is best-effort
  }

  await logAuditEvent(supabase, guard.user.id, "event.deleted", "event", Number(id), {
    title: event?.title,
  });

  return NextResponse.json({ success: true });
}
