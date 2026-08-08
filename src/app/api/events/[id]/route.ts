import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as eventDao from "@/modules/events/db/event.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { eventPartialSchema } from "@/modules/events/lib/schemas";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import type { StorageBucket } from "@/shared/integrations/storage/policy";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  const userRole = user?.role ?? null;

  const event = await eventDao.findByIdWithCourse(supabase, Number(id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // A facilitator's detail view is restricted to the events they are assigned
  // to, so a direct URL cannot bypass the dashboard's filtering.
  if (userRole === "facilitator" && user?.id != null) {
    const assigned = await facilitatorDao.isAssigned(supabase, Number(id), user.id);
    if (!assigned) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
  }

  if (event.status === "draft" && !hasMinRole(userRole, "facilitator")) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (hasMinRole(userRole, "facilitator")) {
    const attendeeCount = await eventDao.getAttendeeCount(supabase, Number(id));
    return NextResponse.json({
      ...event,
      attendee_count: attendeeCount,
      facilitator_ids: (event.EVENT_FACILITATOR ?? []).map((f) => f.user_id),
      speaker_profile_ids: (event.EVENT_SPEAKER ?? []).map((es) => es.speaker_profile_id),
    });
  }

  return NextResponse.json(event);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  // A patch that moves only one end of the range still has to be checked
  // against the end it leaves alone, otherwise chk_event_time rejects it in the
  // database and the caller gets a 500 where a 400 belongs.
  if (parsed.data.start_time !== undefined || parsed.data.end_time !== undefined) {
    const current = await eventDao.findById(supabase, Number(id));
    if (!current) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const startTime = parsed.data.start_time ?? current.start_time;
    const endTime = parsed.data.end_time ?? current.end_time;
    if (startTime >= endTime) {
      return NextResponse.json({ error: { message: "start_time must be before end_time" } }, { status: 400 });
    }
  }

  // facilitator_ids and speaker_profile_ids are not EVENT columns; they are
  // synced to their join tables so they must not reach the EVENT update.
  const { facilitator_ids, speaker_profile_ids, ...eventFields } = parsed.data;

  if (facilitator_ids !== undefined) {
    const synced = await facilitatorDao.replaceEventAssignments(supabase, Number(id), facilitator_ids, guard.user.id);
    if (!synced) {
      return NextResponse.json({ error: { message: "Failed to update facilitators" } }, { status: 500 });
    }
  }

  if (speaker_profile_ids !== undefined) {
    const synced = await speakerDao.replaceEventAssignments(supabase, Number(id), speaker_profile_ids);
    if (!synced) {
      return NextResponse.json({ error: { message: "Failed to update speakers" } }, { status: 500 });
    }
  }

  const event = await eventDao.update(supabase, Number(id), eventFields);

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
    return guardFailure(guard);
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
