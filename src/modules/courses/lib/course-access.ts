import { NextResponse } from "next/server";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";
import type { DbClient } from "@/shared/db/dao/types";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";

/**
 * Whether a user is part of the team that runs the course's event. Admins are
 * global; facilitators and speakers are decided by EVENT_FACILITATOR /
 * EVENT_SPEAKER rows; anything else never manages a course.
 */
export async function canManageEvent(
  supabase: DbClient,
  userId: number,
  userRole: UserRole,
  eventId: number,
): Promise<boolean> {
  if (hasMinRole(userRole, "admin")) return true;
  if (userRole === "facilitator") return facilitatorDao.checkAssignment(supabase, userId, eventId);
  if (userRole === "speaker") return speakerDao.isAssignedByUserId(supabase, userId, eventId);
  return false;
}

export async function requireCourseAccess(courseId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseEvent(supabase, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!(await canManageEvent(supabase, userId, userRole, course.event_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function requireModuleAccess(moduleId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByModule(supabase, moduleId);
  if (!course) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (!(await canManageEvent(supabase, userId, userRole, course.event_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function requireLessonAccess(lessonId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByLesson(supabase, lessonId);
  if (!course) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (!(await canManageEvent(supabase, userId, userRole, course.event_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function requireCourseDeleteAccess(
  courseId: number,
  userId: number,
  userRole: UserRole,
): Promise<NextResponse | null> {
  if (hasMinRole(userRole, "admin")) return null;
  if (userRole !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = getServiceClient();
  const course = await courseDao.findCourseEvent(supabase, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const assigned = await facilitatorDao.checkAssignment(supabase, userId, course.event_id);
  if (!assigned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
