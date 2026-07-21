import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { eventPartialSchema } from "@/modules/event-management";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = getServiceClient();

  const { data: event, error } = await supabase
    .from("EVENTS")
    .select("*, COURSE(*), EVENT_SPEAKERS(SPEAKER_PROFILES(*, USERS(full_name, email)))")
    .eq("event_id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let userRole: string | null = null;
  if (userId) {
    const { data: user } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
    userRole = user?.role ?? null;
  }

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (userRole === "facilitator") {
    const { count: attendeeCount } = await supabase
      .from("TICKETS")
      .select("ticket_id", { count: "exact", head: true })
      .eq("event_id", id)
      .neq("status", "cancelled");
    return NextResponse.json({ ...event, attendee_count: attendeeCount ?? 0 });
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
    const { data: courseExists } = await supabase
      .from("COURSE")
      .select("course_id")
      .eq("course_id", parsed.data.course_id)
      .single();

    if (!courseExists) {
      return NextResponse.json({ error: { message: "Course not found" } }, { status: 400 });
    }
  }

  const { data: event, error } = await supabase.from("EVENTS").update(parsed.data).eq("event_id", id).select().single();

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
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

  const { data: event } = await supabase.from("EVENTS").select("cover_image_url, course_id").eq("event_id", id).single();

  if (event?.cover_image_url) {
    const imagePath = event.cover_image_url.split("/").pop();
    if (imagePath) {
      const { data: eventFiles } = await supabase.storage.from("event_images").list(`events/${id}`);
      const paths = (eventFiles ?? []).map((f) => `events/${id}/${f.name}`);
      await deleteFromStorage("event_images", paths);
    }
  }

  if (event?.course_id) {
    const modules = await supabase.from("MODULES").select("module_id").eq("course_id", event.course_id);
    for (const mod of modules.data ?? []) {
      const lessons = await supabase.from("LESSONS").select("lesson_id").eq("module_id", mod.module_id);
      for (const lesson of lessons.data ?? []) {
        const folder = `courses/${event.course_id}/modules/${mod.module_id}/lessons/${lesson.lesson_id}`;
        const [assetPaths, videoPaths] = await Promise.all([
          listStorageFolder("course_assets", folder),
          listStorageFolder("course_videos", folder),
        ]);
        await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
      }
    }
  }

  const { data: payments } = await supabase.from("PAYMENTS").select("payment_id").eq("event_id", id);
  const paymentIds = (payments ?? []).map((p) => p.payment_id);

  if (paymentIds.length > 0) {
    const { error: ticketErr } = await supabase.from("TICKETS").delete().in("payment_id", paymentIds);
    if (ticketErr) {
      return NextResponse.json({ error: { message: ticketErr.message } }, { status: 500 });
    }

    const { error: paymentErr } = await supabase.from("PAYMENTS").delete().in("payment_id", paymentIds);
    if (paymentErr) {
      return NextResponse.json({ error: { message: paymentErr.message } }, { status: 500 });
    }
  }

  const { error } = await supabase.from("EVENTS").delete().eq("event_id", id);

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
