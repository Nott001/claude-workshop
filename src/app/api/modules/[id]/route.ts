import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { hasMinRole } from "@/shared/auth/role-hierarchy";
import type { UserRole } from "@/shared/types";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage";
import { logAuditEvent } from "@/modules/audit";

async function requireModuleAccess(
  moduleId: number,
  userId: number,
  userRole: string,
): Promise<ReturnType<typeof NextResponse.json> | null> {
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByModule(supabase, moduleId);
  if (!course) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }
  if (course.created_by !== userId) {
    if (!hasMinRole(userRole as UserRole, "facilitator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const body = await req.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();
  const mod = await courseDao.updateModule(supabase, Number(id), {
    module_name: parsed.data.module_name,
    sequence_order: parsed.data.sequence_order,
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
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
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
