import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { eventDao, courseDao } from "@/shared/db/dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const event = await eventDao.findById(supabase, Number(id));
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: state } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("*, LESSON(id, description, content_type)")
    .eq("event_id", id)
    .single();

  if (!state) {
    return NextResponse.json({ highlighted_lesson_id: null, updated_by: null, updated_at: null, lesson: null });
  }

  return NextResponse.json({
    highlighted_lesson_id: state.highlighted_lesson_id,
    updated_by: state.updated_by,
    updated_at: state.updated_at,
    lesson: state.LESSON ?? null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "speaker")) {
    return NextResponse.json({ error: "Only speakers and facilitators can update the live highlight" }, { status: 403 });
  }

  const event = await eventDao.findById(supabase, Number(id));
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await req.json();
  const lessonId = body.lesson_id ?? null;

  if (lessonId !== null) {
    const lesson = await courseDao.findLessonById(supabase, lessonId);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const mod = await courseDao.findModuleById(supabase, lesson.module_id);

    const { data: eventCourse } = await supabase.from("COURSE").select("id").eq("event_id", Number(id)).maybeSingle();

    if (!mod || !eventCourse || mod.course_id !== eventCourse.id) {
      return NextResponse.json({ error: "Lesson does not belong to this event's course" }, { status: 400 });
    }
  }

  const { data: state, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      {
        event_id: Number(id),
        highlighted_lesson_id: lessonId,
        updated_by: user.id,
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "speaker")) {
    return NextResponse.json({ error: "Only speakers and facilitators can clear the live highlight" }, { status: 403 });
  }

  const { error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      {
        event_id: Number(id),
        highlighted_lesson_id: null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ highlighted_lesson_id: null });
}
