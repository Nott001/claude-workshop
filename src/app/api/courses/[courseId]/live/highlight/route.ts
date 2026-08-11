import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import type { UserRole } from "@/shared/types";
import * as courseDao from "@/shared/db/dao/course.dao";
import { canManageEvent } from "@/modules/courses/lib/course-access";
import { CourseServiceError } from "@/modules/courses/lib/course-errors";
import { clearCourseHighlight, getCourseHighlight, setCourseHighlight } from "@/modules/courses/lib/live-session-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof CourseServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

async function requireHighlightAccess(
  supabase: ReturnType<typeof getServiceClient>,
  courseId: number,
  userId: number,
  userRole: UserRole,
): Promise<NextResponse | null> {
  const course = await courseDao.findCourseEvent(supabase, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (!(await canManageEvent(supabase, userId, userRole, course.event_id))) {
    return NextResponse.json({ error: "Only assigned staff can update the live highlight" }, { status: 403 });
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  try {
    const state = await getCourseHighlight(supabase, Number(courseId));
    return NextResponse.json(state);
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = await requireHighlightAccess(supabase, Number(courseId), user.id, user.role);
  if (denied) return denied;

  const body = await req.json();
  const lessonId = body.lesson_id ?? null;

  try {
    const state = await setCourseHighlight(supabase, Number(courseId), lessonId, { id: user.id });
    return NextResponse.json(state);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = await requireHighlightAccess(supabase, Number(courseId), user.id, user.role);
  if (denied) return denied;

  try {
    const result = await clearCourseHighlight(supabase, Number(courseId), { id: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
