import { NextResponse } from "next/server";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";

export async function requireModuleAccess(moduleId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByModule(supabase, moduleId);
  if (!course) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (course.created_by !== userId) {
    if (!hasMinRole(userRole, "facilitator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}

export async function requireLessonAccess(lessonId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByLesson(supabase, lessonId);
  if (!course) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (course.created_by !== userId) {
    if (!hasMinRole(userRole, "facilitator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}

export async function requireCourseAccess(courseId: number, userId: number, userRole: UserRole): Promise<NextResponse | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseOwner(supabase, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.created_by !== userId) {
    if (!hasMinRole(userRole, "facilitator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}
