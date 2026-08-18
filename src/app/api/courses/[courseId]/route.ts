import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { requireCourseAccess, requireCourseDeleteAccess } from "@/modules/courses/lib/course-access";
import { courseSchema } from "@/modules/courses/lib/schemas";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { badRequest } from "@/shared/lib/api-response";

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { courseId } = await params;
  const supabase = getServiceClient();

  // Reading the course tree exposes the whole curriculum, so it is gated like
  // the writes: only the event's own team, not every speaker in the system.
  const access = await requireCourseAccess(Number(courseId), guard.user.id, guard.user.role);
  if (access) {
    return access;
  }

  const course = await courseDao.findCourseWithDetails(supabase, Number(courseId));

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(course);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { courseId } = await params;
  const supabase = getServiceClient();

  const access = await requireCourseAccess(Number(courseId), guard.user.id, guard.user.role);
  if (access) {
    return access;
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const updated = await courseDao.updateCourse(supabase, Number(courseId), {
    course_name: parsed.data.course_name,
    course_description: parsed.data.course_description ?? null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }

  await requireAuditEvent(supabase, guard.user.id, "course.updated", "course", Number(courseId), {
    changes: Object.keys(parsed.data),
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { courseId } = await params;
  const supabase = getServiceClient();

  const access = await requireCourseDeleteAccess(Number(courseId), guard.user.id, guard.user.role);
  if (access) {
    return access;
  }

  const courseInfo = await courseDao.findCourseById(supabase, Number(courseId));
  if (!courseInfo) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const modules = await courseDao.findModulesByCourse(supabase, Number(courseId));
  for (const mod of modules) {
    const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
    for (const lesson of lessons) {
      const folder = `courses/${courseId}/modules/${mod.id}/lessons/${lesson.id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const ok = await courseDao.deleteCourse(supabase, Number(courseId));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }

  await requireAuditEvent(supabase, guard.user.id, "course.deleted", "course", Number(courseId), {
    name: courseInfo?.course_name,
  });

  return NextResponse.json({ ok: true });
}
