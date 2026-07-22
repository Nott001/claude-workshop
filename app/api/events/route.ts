import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { eventSchema } from "@/modules/event-management";
import { logAuditEvent } from "@/modules/audit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");
  const { userId } = await auth();
  const supabase = getServiceClient();

  let userRole: string | null = null;
  if (userId) {
    const { data: user } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
    userRole = user?.role ?? null;
  }

  let query = supabase.from("EVENTS").select("*, COURSE(course_name)").order("event_date", { ascending: true });

  if (userRole !== "facilitator") {
    query = query.in("status", ["active", "complete"]);
  }

  if (filter === "upcoming") {
    query = query.gte("event_date", new Date().toISOString().split("T")[0]);
  } else if (filter === "past") {
    query = query.lt("event_date", new Date().toISOString().split("T")[0]);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
    const { data: courseExists } = await supabase
      .from("COURSE")
      .select("course_id")
      .eq("course_id", parsed.data.course_id)
      .single();

    if (!courseExists) {
      return NextResponse.json({ error: { message: "Course not found" } }, { status: 400 });
    }
  }

  const { data: event, error } = await supabase
    .from("EVENTS")
    .insert({
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "event.created", "event", event.event_id, {
      title: event.title,
    });
  }

  return NextResponse.json(event, { status: 201 });
}
