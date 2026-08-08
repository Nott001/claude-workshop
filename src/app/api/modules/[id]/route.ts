import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { findTimeOverlaps } from "@/modules/courses/lib/scheduling";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const body = await req.json();

  if (body.is_locked !== undefined) {
    const supabase = getServiceClient();
    const mod = await courseDao.setModuleLock(supabase, Number(id), body.is_locked);
    if (!mod) {
      return NextResponse.json({ error: "Failed to update lock state" }, { status: 500 });
    }
    return NextResponse.json(mod);
  }

  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  // A module may only be assigned a speaker who is assigned to the event the
  // module's course teaches. `null` is the clear value and needs no check.
  if (parsed.data.speaker_profile_id !== undefined && parsed.data.speaker_profile_id !== null) {
    const course = await courseDao.findCourseByModule(supabase, Number(id));
    const assigned =
      course !== null && (await speakerDao.checkSpeakerAssignment(supabase, parsed.data.speaker_profile_id, course.event_id));
    if (!assigned) {
      return NextResponse.json({ error: { message: "Speaker is not assigned to this event" } }, { status: 400 });
    }
  }

  // An edit may not make the module collide with another session. A pre-existing
  // overlap between two untouched modules is surfaced elsewhere, not a reason to
  // refuse an unrelated edit, so only a conflict involving the edited module is
  // rejected.
  if (parsed.data.start_time !== undefined || parsed.data.end_time !== undefined) {
    const current = await courseDao.findModuleById(supabase, Number(id));
    if (!current) {
      return NextResponse.json({ error: "Failed to load module" }, { status: 500 });
    }
    const merged = {
      start_time: parsed.data.start_time ?? current.start_time,
      end_time: parsed.data.end_time ?? current.end_time,
    };
    const siblings = await courseDao.findModulesByCourse(supabase, current.course_id);
    const proposed = siblings.map((m) => (m.id === Number(id) ? { ...m, ...merged } : m));
    const conflict = findTimeOverlaps(proposed).find(([a, b]) => a.id === Number(id) || b.id === Number(id));
    if (conflict) {
      const other = conflict[0].id === Number(id) ? conflict[1] : conflict[0];
      return NextResponse.json({ error: { message: `Time overlaps with "${other.module_name}"` } }, { status: 400 });
    }
  }

  const mod = await courseDao.updateModule(supabase, Number(id), {
    module_name: parsed.data.module_name,
    sequence_order: parsed.data.sequence_order,
    ...(parsed.data.start_time !== undefined && { start_time: parsed.data.start_time, end_time: parsed.data.end_time }),
    ...(parsed.data.speaker_profile_id !== undefined && { speaker_profile_id: parsed.data.speaker_profile_id }),
  });

  if (!mod) {
    return NextResponse.json({ error: "Failed to update module" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "module.updated", "module", Number(id), {
    changes: Object.keys(parsed.data),
  });

  return NextResponse.json(mod);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const supabase = getServiceClient();

  const mod = await courseDao.findModuleById(supabase, Number(id));
  if (mod) {
    const lessons = await courseDao.findLessonsByModule(supabase, Number(id));
    for (const lesson of lessons) {
      const folder = `courses/${mod.course_id}/modules/${id}/lessons/${lesson.id}`;
      const [assetPaths, videoPaths] = await Promise.all([
        listStorageFolder("course_assets", folder),
        listStorageFolder("course_videos", folder),
      ]);
      await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
    }
  }

  const ok = await courseDao.deleteModule(supabase, Number(id));

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete module" }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "module.deleted", "module", Number(id), {
    course_id: mod?.course_id,
  });

  return NextResponse.json({ success: true });
}
