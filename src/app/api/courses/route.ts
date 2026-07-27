import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { courseDao } from "@/lib/db/dao";
import { courseSchema } from "@/modules/course-content";
import { logAuditEvent } from "@/modules/audit";

export async function GET() {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const courses = await courseDao.listCourses(supabase);

  return NextResponse.json(courses);
}

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
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
  });

  if (!course) {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }

  const user = await requireAuth(supabase);
  if (user) {
    await logAuditEvent(supabase, user.id, "course.created", "course", course.id, {
      name: course.course_name,
    });
  }

  return NextResponse.json(course, { status: 201 });
}
