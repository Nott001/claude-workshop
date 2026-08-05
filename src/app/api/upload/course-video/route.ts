import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { uploadToStorage } from "@/shared/integrations/storage/service";
import { buildCourseVideoPath, validateFileType, validateFileSize } from "@/shared/integrations/storage/policy";

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const lessonId = formData.get("lesson_id") as string | null;
  const courseId = formData.get("course_id") as string | null;
  const moduleId = formData.get("module_id") as string | null;

  if (!file || !lessonId || !courseId || !moduleId) {
    return NextResponse.json({ error: "file, lesson_id, course_id, and module_id are required" }, { status: 400 });
  }

  if (!validateFileType("course_videos", file.type)) {
    return NextResponse.json({ error: "File type not allowed for course videos" }, { status: 400 });
  }

  if (!validateFileSize("course_videos", file.size)) {
    return NextResponse.json({ error: "File size must be under 50 MB" }, { status: 400 });
  }

  const filename = file.name || `video.${file.type.split("/")[1]}`;
  const path = buildCourseVideoPath(Number(courseId), Number(moduleId), Number(lessonId), filename);

  try {
    const result = await uploadToStorage("course_videos", path, file);

    const supabase = getServiceClient();
    const updated = await courseDao.updateLesson(supabase, Number(lessonId), { content_url: result.url });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
    }

    return NextResponse.json({ url: result.url, path: result.path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
