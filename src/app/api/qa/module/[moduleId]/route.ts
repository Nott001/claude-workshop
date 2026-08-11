import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import { qaMessageSchema } from "@/modules/chat/lib/schemas";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat/lib/rate-limit";

export async function GET(_req: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const supabase = getServiceClient();

  const mod = await courseDao.findModuleById(supabase, Number(moduleId));
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { messages } = await chatDao.qaMessageDao.listQuestionsByModule(supabase, Number(moduleId), {
    before: null,
    after: null,
    limit: 50,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const body = await req.json();
  const parsed = qaMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const mod = await courseDao.findModuleById(supabase, Number(moduleId));
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  if (mod.module_type !== "qa") {
    return NextResponse.json({ error: "Module is not a Q&A module" }, { status: 400 });
  }

  if (mod.is_locked) {
    return NextResponse.json({ error: "Q&A is locked" }, { status: 403 });
  }

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const count = await chatDao.qaMessageDao.listQuestionsByModule(supabase, Number(moduleId), {
    before: null,
    after: windowStart,
    limit: RATE_LIMIT_MAX,
  });

  if (count.messages.length >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const course = await courseDao.findCourseEvent(supabase, mod.course_id);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const message = await chatDao.qaMessageDao.sendQuestion(supabase, {
    event_id: course.event_id,
    module_id: Number(moduleId),
    user_id: user.id,
    message: parsed.data.message,
  });

  if (!message) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const access = await requireModuleAccess(Number(moduleId), guard.user.id, guard.user.role);
  if (access) {
    return access;
  }

  const supabase = getServiceClient();
  const body = await req.json();

  if (body.is_locked === undefined) {
    return NextResponse.json({ error: "is_locked is required" }, { status: 400 });
  }

  const mod = await courseDao.setModuleLock(supabase, Number(moduleId), body.is_locked);
  if (!mod) {
    return NextResponse.json({ error: "Failed to update lock state" }, { status: 500 });
  }

  return NextResponse.json(mod);
}
