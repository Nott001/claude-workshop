import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { eventDao, courseDao, paymentDao, ticketDao } from "@/lib/db/dao";
import { eventPartialSchema } from "@/modules/event-management";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";
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

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (userRole === "facilitator") {
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

  if (parsed.data.course_id !== undefined && parsed.data.course_id !== null) {
    const courseExists = await courseDao.findCourseById(supabase, parsed.data.course_id);
    if (!courseExists) {
      return NextResponse.json({ error: { message: "Course not found" } }, { status: 400 });
    }
  }

  const event = await eventDao.update(supabase, Number(id), parsed.data);

  if (!event) {
    return NextResponse.json({ error: { message: "Failed to update event" } }, { status: 500 });
  }

  const user = await requireAuth(supabase);
  if (user) {
    await logAuditEvent(supabase, user.id, "event.updated", "event", Number(id), {
      changes: Object.keys(parsed.data),
    });
  }

  return NextResponse.json(event);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();
  const user = await requireAuth(supabase);

  const event = await eventDao.findById(supabase, Number(id));

  if (event?.cover_image_url) {
    const imagePath = event.cover_image_url.split("/").pop();
    if (imagePath) {
      const { data: eventFiles } = await supabase.storage.from("event_images").list(`events/${id}`);
      const paths = (eventFiles ?? []).map((f) => `events/${id}/${f.name}`);
      await deleteFromStorage("event_images", paths);
    }
  }

  if (event?.course_id) {
    const modules = await courseDao.findModulesByCourse(supabase, event.course_id);
    for (const mod of modules) {
      const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
      for (const lesson of lessons) {
        const folder = `courses/${event.course_id}/modules/${mod.id}/lessons/${lesson.id}`;
        const [assetPaths, videoPaths] = await Promise.all([
          listStorageFolder("course_assets", folder),
          listStorageFolder("course_videos", folder),
        ]);
        await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
      }
    }
  }

  const paymentIds = await paymentDao.deleteByEvent(supabase, Number(id));

  if (paymentIds.length > 0) {
    const ok = await ticketDao.deleteByPaymentIds(supabase, paymentIds);
    if (!ok) {
      return NextResponse.json({ error: { message: "Failed to delete tickets" } }, { status: 500 });
    }
  }

  const removed = await eventDao.remove(supabase, Number(id));

  if (!removed) {
    return NextResponse.json({ error: { message: "Failed to delete event" } }, { status: 500 });
  }

  if (user) {
    await logAuditEvent(supabase, user.id, "event.deleted", "event", Number(id), {
      title: event?.title,
    });
  }

  return NextResponse.json({ success: true });
}
