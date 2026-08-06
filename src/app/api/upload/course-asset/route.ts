import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { requireLessonAccess } from "@/modules/courses/lib/course-access";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import { optimizeImage } from "@/shared/integrations/storage/optimize";
import { uploadToStorage } from "@/shared/integrations/storage/service";
import {
  buildCourseAssetPath,
  sanitizeObjectName,
  validateFileType,
  validateFileSize,
} from "@/shared/integrations/storage/policy";

export async function POST(req: Request) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const lessonId = formData.get("lesson_id") as string | null;

  if (!file || !lessonId) {
    return NextResponse.json({ error: "file and lesson_id are required" }, { status: 400 });
  }

  if (!validateFileType("course_assets", file.type)) {
    return NextResponse.json({ error: "File type not allowed for course assets" }, { status: 400 });
  }

  if (!validateFileSize("course_assets", file.size)) {
    return NextResponse.json({ error: "File size must be under 50 MB" }, { status: 400 });
  }

  // The stored path is derived from the lesson's own module and course ids, and
  // the client filename is reduced to its basename, so neither the ids nor a
  // path smuggled into the filename can redirect an upload outside this lesson.
  const supabase = getServiceClient();
  const lesson = await courseDao.findLessonModule(supabase, Number(lessonId));
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 400 });
  }
  const mod = await courseDao.findModuleCourse(supabase, lesson.module_id);
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 400 });
  }
  const course = await courseDao.findCourseEvent(supabase, mod.course_id);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 400 });
  }

  const access = await requireLessonAccess(Number(lessonId), guard.user.id, guard.user.role, { supabase, course });
  if (access) {
    return access;
  }

  const optimizedFile = await optimizeImage(file);
  const filename = sanitizeObjectName(file.name, `asset.${file.type.split("/")[1]}`);
  const path = buildCourseAssetPath(mod.course_id, lesson.module_id, Number(lessonId), filename);

  try {
    const result = await uploadToStorage("course_assets", path, optimizedFile);

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
