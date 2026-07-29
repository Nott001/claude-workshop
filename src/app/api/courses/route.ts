import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { courseSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit";

export async function GET() {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const courses = await courseDao.listCoursesWithEvents(supabase);

  return NextResponse.json(courses);
}

export async function POST(req: Request) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const course = await courseDao.createCourse(supabase, {
    course_name: parsed.data.course_name,
    course_description: parsed.data.course_description ?? null,
    event_id: parsed.data.event_id,
    created_by: guard.user.id,
  });

  if (!course) {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "course.created", "course", course.id, {
    name: course.course_name,
  });

  return NextResponse.json(course, { status: 201 });
}
