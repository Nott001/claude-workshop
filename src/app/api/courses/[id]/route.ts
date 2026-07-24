import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { courseSchema } from "@/modules/course-content";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: course, error } = await supabase
    .from("COURSE")
    .select(
      `
      *,
      MODULES (
        *,
        LESSONS (*)
      ),
      EVENTS (
        event_id,
        title,
        event_date,
        status
      )
    `,
    )
    .eq("course_id", id)
    .order("sequence_order", { foreignTable: "MODULES", ascending: true })
    .order("sequence_order", {
      foreignTable: "MODULES.LESSONS",
      ascending: true,
    })
    .single();

  if (error) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: course, error } = await supabase
    .from("COURSE")
    .update({ course_name: parsed.data.course_name, course_description: parsed.data.course_description ?? null })
    .eq("course_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "course.updated", "course", Number(id), {
      changes: Object.keys(parsed.data),
    });
  }

  return NextResponse.json(course);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();
  const { userId } = await auth();

  const { data: courseInfo } = await supabase.from("COURSE").select("course_name").eq("course_id", id).single();

  const { data: modules } = await supabase.from("MODULES").select("module_id").eq("course_id", id);
  for (const mod of modules ?? []) {
    const { data: lessons } = await supabase.from("LESSONS").select("lesson_id").eq("module_id", mod.module_id);
    for (const lesson of lessons ?? []) {
      const folder = `courses/${id}/modules/${mod.module_id}/lessons/${lesson.lesson_id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const { error } = await supabase.from("COURSE").delete().eq("course_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (userId) {
    await logAuditEvent(supabase, userId, "course.deleted", "course", Number(id), {
      name: courseInfo?.course_name,
    });
  }

  return NextResponse.json({ success: true });
}
