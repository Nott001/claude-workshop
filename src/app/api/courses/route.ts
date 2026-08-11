import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { canManageEvent } from "@/modules/courses/lib/course-access";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { courseSchema } from "@/modules/courses/lib/schemas";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const courses = await courseDao.listCoursesWithEvents(supabase, {
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
  });

  return NextResponse.json(courses);
}

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  if (!(await canManageEvent(supabase, guard.user.id, guard.user.role, parsed.data.event_id))) {
    return NextResponse.json({ error: "You are not assigned to this event" }, { status: 403 });
  }

  const result = await courseDao.createCourse(supabase, {
    course_name: parsed.data.course_name,
    course_description: parsed.data.course_description ?? null,
    event_id: parsed.data.event_id,
  });

  if (!result.course) {
    return result.reason === "conflict"
      ? NextResponse.json({ error: "This event already has a course" }, { status: 409 })
      : NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
  const course = result.course;

  await requireAuditEvent(supabase, guard.user.id, "course.created", "course", course.id, {
    name: course.course_name,
  });

  return NextResponse.json(course, { status: 201 });
}
