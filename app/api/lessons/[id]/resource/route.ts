import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: lesson } = await supabase.from("LESSONS").select("module_id").eq("lesson_id", id).single();
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const { data: mod } = await supabase.from("MODULES").select("course_id").eq("module_id", lesson.module_id).single();

  if (mod) {
    const folder = `courses/${mod.course_id}/modules/${lesson.module_id}/lessons/${id}`;
    const [assetPaths, videoPaths] = await Promise.all([
      listStorageFolder("course_assets", folder),
      listStorageFolder("course_videos", folder),
    ]);
    await Promise.all([deleteFromStorage("course_assets", assetPaths), deleteFromStorage("course_videos", videoPaths)]);
  }

  const { error } = await supabase.from("LESSONS").update({ content_url: null }).eq("lesson_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
