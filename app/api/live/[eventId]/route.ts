import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { liveSessionUpdateSchema } from "@/modules/live-session";

async function validateLessonBelongsToEvent(lessonId: number, eventId: number): Promise<boolean> {
  const supabase = getServiceClient();

  const { data: event } = await supabase.from("EVENTS").select("course_id").eq("event_id", eventId).single();

  if (!event?.course_id) return false;

  const { data: lesson } = await supabase.from("LESSONS").select("module_id").eq("lesson_id", lessonId).single();

  if (!lesson) return false;

  const { data: module } = await supabase
    .from("MODULES")
    .select("course_id")
    .eq("module_id", lesson.module_id)
    .eq("course_id", event.course_id)
    .single();

  return !!module;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: state, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("*, LESSON:current_lesson_id(*), UPDATER:updated_by(full_name)")
    .eq("event_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!state) {
    return NextResponse.json({
      event_id: Number(id),
      current_lesson_id: null,
      session_status: "scheduled",
      updated_by: null,
      updated_at: null,
    });
  }

  return NextResponse.json(state);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = liveSessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = await auth();
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (parsed.data.current_lesson_id !== null) {
    const valid = await validateLessonBelongsToEvent(parsed.data.current_lesson_id, Number(id));
    if (!valid) {
      return NextResponse.json({ error: "Lesson does not belong to this event's course" }, { status: 400 });
    }
  }

  const { data: state, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      {
        event_id: Number(id),
        current_lesson_id: parsed.data.current_lesson_id,
        session_status: "live",
        updated_by: dbUser.user_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(state);
}
