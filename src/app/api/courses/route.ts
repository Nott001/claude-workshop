import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { courseSchema } from "@/modules/courses/lib/schemas";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

export async function GET() {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();
  const courses = await courseDao.listCoursesWithEvents(supabase);

  return NextResponse.json(courses);
}

export async function POST(req: Request) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  if (!hasMinRole(guard.user.role, "facilitator")) {
    const profile = await speakerDao.findByUserId(supabase, guard.user.id);
    if (!profile) {
      return NextResponse.json({ error: "No speaker profile found" }, { status: 400 });
    }
    const assigned = await speakerDao.checkSpeakerAssignment(supabase, profile.id, parsed.data.event_id);
    if (!assigned) {
      return NextResponse.json({ error: "You are not assigned as a speaker to this event" }, { status: 403 });
    }
  }

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
