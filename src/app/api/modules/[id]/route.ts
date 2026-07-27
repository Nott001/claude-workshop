import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { courseDao } from "@/lib/db/dao";
import { moduleSchema } from "@/modules/course-content";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";
import { logAuditEvent } from "@/modules/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
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

  const { userId } = await auth();
  if (userId) {
    await logAuditEvent(supabase, userId, "module.updated", "module", Number(id), {
      changes: Object.keys(parsed.data),
    });
  }

  return NextResponse.json(mod);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();
  const { userId } = await auth();

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

  if (userId) {
    await logAuditEvent(supabase, userId, "module.deleted", "module", Number(id), {
      course_id: mod?.course_id,
    });
  }

  return NextResponse.json({ success: true });
}
