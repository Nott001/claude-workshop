import type { DbClient } from "./types";
import type { Course, Module, Lesson } from "@/shared/types";

export async function listCourses(supabase: DbClient): Promise<Course[]> {
  const { data } = await supabase.from("COURSE").select("*").order("id", { ascending: false });
  return (data ?? []) as Course[];
}

export type CourseWithEvent = Course & {
  event_title: string | null;
  event_date: string | null;
  event_id: number | null;
};

export async function listCoursesWithEvents(supabase: DbClient): Promise<CourseWithEvent[]> {
  const { data: courses } = await supabase.from("COURSE").select("*").order("id", { ascending: false });
  if (!courses) return [];

  const courseIds = (courses as Course[]).map((c) => c.id);

  if (courseIds.length === 0) return [];

  const { data: events } = await supabase.from("EVENT").select("id, title, event_date, course_id").in("course_id", courseIds);

  const eventMap = new Map<number, { id: number; title: string; event_date: string }>();
  for (const e of (events ?? []) as Array<{ id: number; title: string; event_date: string; course_id: number }>) {
    if (!eventMap.has(e.course_id)) {
      eventMap.set(e.course_id, { id: e.id, title: e.title, event_date: e.event_date });
    }
  }

  return (courses as Course[]).map((course) => {
    const linked = eventMap.get(course.id);
    return {
      ...course,
      event_id: linked?.id ?? null,
      event_title: linked?.title ?? null,
      event_date: linked?.event_date ?? null,
    };
  });
}

export async function findCourseById(supabase: DbClient, id: number): Promise<Course | null> {
  const { data } = await supabase.from("COURSE").select("*").eq("id", id).single();
  return data;
}

export async function findCourseWithDetails(supabase: DbClient, id: number): Promise<unknown> {
  const { data } = await supabase
    .from("COURSE")
    .select(
      `
      *,
      MODULE (
        *,
        LESSON (*)
      ),
      EVENT (
        id,
        title,
        event_date,
        status
      )
    `,
    )
    .eq("id", id)
    .order("sequence_order", { foreignTable: "MODULE", ascending: true })
    .order("sequence_order", {
      foreignTable: "MODULE.LESSON",
      ascending: true,
    })
    .single();

  return data;
}

export async function createCourse(
  supabase: DbClient,
  data: { course_name: string; course_description: string | null },
): Promise<Course | null> {
  const { data: course, error } = await supabase.from("COURSE").insert(data).select("*").single();

  if (error) {
    console.error("course.dao.createCourse failed:", error.message, error.code);
    return null;
  }
  return course;
}

export async function updateCourse(
  supabase: DbClient,
  id: number,
  data: { course_name: string; course_description: string | null },
): Promise<Course | null> {
  const { data: course, error } = await supabase.from("COURSE").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("course.dao.updateCourse failed:", error.message, error.code);
    return null;
  }
  return course;
}

export async function deleteCourse(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("COURSE").delete().eq("id", id);
  return !error;
}

export async function findModulesByCourse(supabase: DbClient, courseId: number): Promise<Module[]> {
  const { data } = await supabase.from("MODULE").select("*").eq("course_id", courseId);
  return (data ?? []) as Module[];
}

export async function findModuleById(supabase: DbClient, id: number): Promise<{ course_id: number } | null> {
  const { data } = await supabase.from("MODULE").select("course_id").eq("id", id).single();
  return data;
}

export async function createModule(
  supabase: DbClient,
  data: { course_id: number; module_name: string; sequence_order: number },
): Promise<Module | null> {
  const { data: module, error } = await supabase.from("MODULE").insert(data).select("*").single();

  if (error) {
    console.error("course.dao.createModule failed:", error.message, error.code);
    return null;
  }
  return module;
}

export async function updateModule(
  supabase: DbClient,
  id: number,
  data: { module_name: string; sequence_order: number },
): Promise<Module | null> {
  const { data: module, error } = await supabase.from("MODULE").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("course.dao.updateModule failed:", error.message, error.code);
    return null;
  }
  return module;
}

export async function deleteModule(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("MODULE").delete().eq("id", id);
  return !error;
}

export async function findLessonsByModule(supabase: DbClient, moduleId: number): Promise<Lesson[]> {
  const { data } = await supabase.from("LESSON").select("*").eq("module_id", moduleId);
  return (data ?? []) as Lesson[];
}

export async function findLessonById(supabase: DbClient, id: number): Promise<Lesson | null> {
  const { data } = await supabase.from("LESSON").select("*").eq("id", id).single();
  return data;
}

export async function findLessonModule(supabase: DbClient, lessonId: number): Promise<{ module_id: number } | null> {
  const { data } = await supabase.from("LESSON").select("module_id").eq("id", lessonId).single();
  return data;
}

export async function findModuleCourse(supabase: DbClient, moduleId: number): Promise<{ course_id: number } | null> {
  const { data } = await supabase.from("MODULE").select("course_id").eq("id", moduleId).single();
  return data;
}

export async function createLesson(
  supabase: DbClient,
  data: {
    module_id: number;
    description: string;
    content_type: string;
    content_url?: string;
    sequence_order: number;
  },
): Promise<Lesson | null> {
  const { data: lesson, error } = await supabase.from("LESSON").insert(data).select("*").single();

  if (error) {
    console.error("course.dao.createLesson failed:", error.message, error.code);
    return null;
  }
  return lesson;
}

export async function updateLesson(supabase: DbClient, id: number, data: Record<string, unknown>): Promise<Lesson | null> {
  const { data: lesson, error } = await supabase.from("LESSON").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("course.dao.updateLesson failed:", error.message, error.code);
    return null;
  }
  return lesson;
}

export async function deleteLesson(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("LESSON").delete().eq("id", id);
  return !error;
}
