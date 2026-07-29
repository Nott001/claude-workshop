import type { DbClient } from "./types";
import type { Course, Module, Lesson } from "@/shared/types";

export async function listCourses(supabase: DbClient): Promise<Course[]> {
  const { data } = await supabase.from("COURSE").select("*").order("id", { ascending: false });
  return (data ?? []) as Course[];
}

export type CourseWithEvent = Course & {
  event_title: string | null;
  event_date: string | null;
  creator_name: string | null;
};

export async function findCreatorName(supabase: DbClient, userId: number): Promise<string | null> {
  const { data } = await supabase.from("USER").select("full_name").eq("id", userId).single();
  return data?.full_name ?? null;
}

export async function findCourseOwner(
  supabase: DbClient,
  courseId: number,
): Promise<{ id: number; created_by: number | null; event_id: number } | null> {
  const { data } = await supabase.from("COURSE").select("id, created_by, event_id").eq("id", courseId).single();
  return data;
}

export async function listCoursesWithEvents(supabase: DbClient): Promise<CourseWithEvent[]> {
  const { data: courses } = await supabase.from("COURSE").select("*").order("id", { ascending: false });
  if (!courses) return [];

  const courseList = courses as Course[];
  const eventIds = courseList.map((c) => c.event_id);
  const userIds = courseList.filter((c) => c.created_by).map((c) => c.created_by!);

  const [events, users] = await Promise.all([
    eventIds.length > 0
      ? supabase.from("EVENT").select("id, title, event_date").in("id", eventIds)
      : Promise.resolve({ data: null }),
    userIds.length > 0 ? supabase.from("USER").select("id, full_name").in("id", userIds) : Promise.resolve({ data: null }),
  ]);

  const eventMap = new Map<number, { id: number; title: string; event_date: string }>();
  for (const e of (events?.data ?? []) as Array<{ id: number; title: string; event_date: string }>) {
    eventMap.set(e.id, e);
  }

  const userMap = new Map<number, string>();
  for (const u of (users?.data ?? []) as Array<{ id: number; full_name: string }>) {
    userMap.set(u.id, u.full_name);
  }

  return (courses as Course[]).map((course) => {
    const linked = eventMap.get(course.event_id);
    return {
      ...course,
      event_title: linked?.title ?? null,
      event_date: linked?.event_date ?? null,
      creator_name: course.created_by ? (userMap.get(course.created_by) ?? null) : null,
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
      EVENT!event_id (
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
    .maybeSingle();

  return data;
}

export async function findCourseByEvent(supabase: DbClient, eventId: number): Promise<unknown> {
  const { data } = await supabase
    .from("COURSE")
    .select(
      `
      *,
      MODULE (
        *,
        LESSON (*)
      )
    `,
    )
    .eq("event_id", eventId)
    .order("sequence_order", { foreignTable: "MODULE", ascending: true })
    .order("sequence_order", { foreignTable: "MODULE.LESSON", ascending: true })
    .maybeSingle();

  return data;
}

export async function createCourse(
  supabase: DbClient,
  data: { course_name: string; course_description: string | null; event_id: number; created_by: number },
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

export async function findCourseByModule(
  supabase: DbClient,
  moduleId: number,
): Promise<{ id: number; created_by: number | null } | null> {
  const mod = await findModuleCourse(supabase, moduleId);
  if (!mod) return null;
  return findCourseOwner(supabase, mod.course_id);
}

export async function findCourseByLesson(
  supabase: DbClient,
  lessonId: number,
): Promise<{ id: number; created_by: number | null } | null> {
  const lesson = await findLessonModule(supabase, lessonId);
  if (!lesson) return null;
  return findCourseByModule(supabase, lesson.module_id);
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

/**
 * Whether a user is entitled to a course's material.
 *
 * Entitlement comes from either holding a live ticket to an event that teaches
 * the course, or being a speaker assigned to one. Facilitators bypass this and
 * are checked by the caller, since that is a role decision rather than a query.
 */
export async function userHasCourseAccess(supabase: DbClient, userId: number, courseId: number): Promise<boolean> {
  // The live schema links these as COURSE.event_id -> EVENT, the opposite of
  // what 00001_initial_schema.sql describes. This follows the database, since
  // that is what the query actually runs against. Revisit if the schemas are
  // ever reconciled — see SPEC-09-TEST-STRATEGY §9.
  const { data: course } = await supabase.from("COURSE").select("event_id").eq("id", courseId).single();
  if (!course?.event_id) return false;

  const { data: ticket } = await supabase
    .from("TICKET")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", course.event_id)
    .neq("status", "cancelled")
    .limit(1);

  if (ticket && ticket.length > 0) return true;

  const { data: speaking } = await supabase
    .from("EVENT_SPEAKER")
    .select("event_id, SPEAKER_PROFILE!inner(user_id)")
    .eq("event_id", course.event_id)
    .eq("SPEAKER_PROFILE.user_id", userId)
    .limit(1);

  return !!speaking && speaking.length > 0;
}
