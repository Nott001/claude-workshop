import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { courseSchema } from "@/modules/courses/lib/schemas";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage";
import { logAuditEvent } from "@/modules/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const course = await courseDao.findCourseWithDetails(supabase, Number(id));

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const course = await courseDao.findCourseOwner(supabase, Number(id));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (course.created_by !== guard.user.id) {
    const isStaff = hasMinRole(guard.user.role, "facilitator");
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await courseDao.updateCourse(supabase, Number(id), {
    course_name: parsed.data.course_name,
    course_description: parsed.data.course_description ?? null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "course.updated", "course", Number(id), {
    changes: Object.keys(parsed.data),
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const courseInfo = await courseDao.findCourseById(supabase, Number(id));
  if (!courseInfo) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (courseInfo.created_by !== guard.user.id) {
    if (!hasMinRole(guard.user.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const modules = await courseDao.findModulesByCourse(supabase, Number(id));
  for (const mod of modules) {
    const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
    for (const lesson of lessons) {
      const folder = `courses/${id}/modules/${mod.id}/lessons/${lesson.id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const ok = await courseDao.deleteCourse(supabase, Number(id));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "course.deleted", "course", Number(id), {
    name: courseInfo?.course_name,
  });

  return NextResponse.json({ success: true });
}
