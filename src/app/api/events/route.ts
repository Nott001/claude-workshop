import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { userDao, eventDao } from "@/lib/db/dao";
import { eventSchema } from "@/modules/event-management";
import { logAuditEvent } from "@/modules/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const { userId } = await auth();
  const supabase = getServiceClient();

  let userRole: string | null = null;
  if (userId) {
    const user = await userDao.findByAuthIdWithRole(supabase, userId);
    userRole = user?.role ?? null;
  }

  const events = await eventDao.list(supabase, { role: userRole, filter });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  if (parsed.data.course_id) {
    const { courseDao } = await import("@/lib/db/dao");
    const course = await courseDao.findCourseById(supabase, parsed.data.course_id);
    if (!course) {
      return NextResponse.json({ error: { message: "Course not found" } }, { status: 400 });
    }
  }

  const event = await eventDao.create(supabase, {
    title: parsed.data.title,
    event_date: parsed.data.event_date,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    venue_name: parsed.data.venue_name,
    venue_address: parsed.data.venue_address ?? null,
    description: parsed.data.description ?? null,
    course_id: parsed.data.course_id ?? null,
    price: parsed.data.price ?? 0,
    currency: parsed.data.currency ?? "PHP",
    cover_image_url: parsed.data.cover_image_url ?? null,
    status: "draft",
  });

  if (!event) {
    return NextResponse.json({ error: { message: "Failed to create event" } }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "event.created", "event", event.id, {
      title: event.title,
    });
  }

  return NextResponse.json(event, { status: 201 });
}
