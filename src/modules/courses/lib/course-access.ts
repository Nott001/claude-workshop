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

interface CoursePointer {
  id: number;
  event_id: number;
}

/**
 * What a route may hand over to skip work the helper would otherwise redo.
 * Routes that already hold an open client and the course row pass them here so
 * the request issues no second client or duplicate query.
 */
export interface CourseAccessContext {
  supabase?: DbClient;
  course?: CoursePointer | null;
}

type Missing = "Course" | "Module" | "Lesson";

async function requireEventAccess(
  userId: number,
  userRole: UserRole,
  ctx: CourseAccessContext,
  resolveCourse: (supabase: DbClient) => Promise<CoursePointer | null>,
  missing: Missing,
): Promise<NextResponse | null> {
  const supabase = ctx.supabase ?? getServiceClient();
  const course = ctx.course !== undefined ? ctx.course : await resolveCourse(supabase);
  if (!course) {
    return NextResponse.json({ error: `${missing} not found` }, { status: 404 });
  }
  if (!(await canManageEvent(supabase, userId, userRole, course.event_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function requireCourseAccess(
  courseId: number,
  userId: number,
  userRole: UserRole,
  ctx: CourseAccessContext = {},
): Promise<NextResponse | null> {
  return requireEventAccess(userId, userRole, ctx, (supabase) => courseDao.findCourseEvent(supabase, courseId), "Course");
}

export async function requireModuleAccess(
  moduleId: number,
  userId: number,
  userRole: UserRole,
  ctx: CourseAccessContext = {},
): Promise<NextResponse | null> {
  return requireEventAccess(userId, userRole, ctx, (supabase) => courseDao.findCourseByModule(supabase, moduleId), "Module");
}

export async function requireLessonAccess(
  lessonId: number,
  userId: number,
  userRole: UserRole,
  ctx: CourseAccessContext = {},
): Promise<NextResponse | null> {
  return requireEventAccess(userId, userRole, ctx, (supabase) => courseDao.findCourseByLesson(supabase, lessonId), "Lesson");
}

export async function requireCourseDeleteAccess(
  courseId: number,
  userId: number,
  userRole: UserRole,
): Promise<NextResponse | null> {
  // Speakers — even assigned ones — may never delete, and anyone below
  // facilitator is refused without a query so the caller learns nothing about
  // whether the course exists.
  if (!hasMinRole(userRole, "facilitator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return requireEventAccess(userId, userRole, {}, (supabase) => courseDao.findCourseEvent(supabase, courseId), "Course");
}
