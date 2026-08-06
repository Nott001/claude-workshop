import type { DbClient } from "./types";
import type { Course, Module, Lesson } from "@/shared/types";

export type CourseWithEvent = Course & {
  event_title: string | null;
  event_date: string | null;
};

export async function findCourseEvent(supabase: DbClient, courseId: number): Promise<{ id: number; event_id: number } | null> {
  const { data } = await supabase.from("COURSE").select("id, event_id").eq("id", courseId).single();
  return data;
}

export async function listCoursesWithEvents(supabase: DbClient): Promise<CourseWithEvent[]> {
  const { data: courses } = await supabase.from("COURSE").select("*").order("id", { ascending: false });
  if (!courses) return [];

  const courseList = courses as Course[];
  const eventIds = courseList.map((c) => c.event_id);

  const events =
    eventIds.length > 0 ? (await supabase.from("EVENT").select("id, title, event_date").in("id", eventIds)).data : null;

  const eventMap = new Map<number, { id: number; title: string; event_date: string }>();
  for (const e of (events ?? []) as Array<{ id: number; title: string; event_date: string }>) {
    eventMap.set(e.id, e);
  }

  return courseList.map((course) => {
    const linked = eventMap.get(course.event_id);
    return {
      ...course,
      event_title: linked?.title ?? null,
      event_date: linked?.event_date ?? null,
    };
  });
}

export async function findCourseById(supabase: DbClient, id: number): Promise<Course | null> {
  const { data } = await supabase.from("COURSE").select("*").eq("id", id).single();
  return data;
}

export interface ModuleWithLessons extends Module {
  LESSONS: Lesson[];
  SPEAKER_PROFILE?: ModuleSpeakerProfile | null;
}

interface ModuleContent extends Module {
  LESSON: Lesson[];
  SPEAKER_PROFILE?: ModuleSpeakerProfile | null;
}

export interface ModuleSpeakerProfile {
  id: number;
  designation: string | null;
  USER: { full_name: string } | null;
}

export interface CourseWithModules extends Course {
  MODULE: ModuleWithLessons[];
}

export interface CourseWithDetails extends CourseWithModules {
  EVENT: { id: number; title: string; event_date: string; status: string } | null;
}

// PostgREST keys an embedded relation by table name, so a `LESSON (*)` embed
// arrives as `LESSON`. Consumers read `LESSONS`; normalise once here so the
// rest of the app never sees the table-level name.
function toLessonsKey<T extends { MODULE: ModuleContent[] }>(
  course: T | null,
): (Omit<T, "MODULE"> & { MODULE: ModuleWithLessons[] }) | null {
  if (!course) return null;
  return {
    ...course,
    MODULE: course.MODULE.map(({ LESSON, ...moduleFields }) => ({ ...moduleFields, LESSONS: LESSON })),
  };
}

export async function findCourseWithDetails(supabase: DbClient, id: number): Promise<CourseWithDetails | null> {
  const { data } = await supabase
    .from("COURSE")
    .select(
      `
      *,
      MODULE (
        *,
        SPEAKER_PROFILE (id, designation, USER (full_name)),
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

  return toLessonsKey(data as (Course & { MODULE: ModuleContent[]; EVENT: CourseWithDetails["EVENT"] }) | null);
}

export async function findCourseByEvent(supabase: DbClient, eventId: number): Promise<CourseWithModules | null> {
  const { data } = await supabase
    .from("COURSE")
    .select(
      `
      *,
      MODULE (
        *,
        SPEAKER_PROFILE (id, designation, USER (full_name)),
        LESSON (*)
      )
    `,
    )
    .eq("event_id", eventId)
    .order("sequence_order", { foreignTable: "MODULE", ascending: true })
    .order("sequence_order", { foreignTable: "MODULE.LESSON", ascending: true })
    .maybeSingle();

  return toLessonsKey(data as (Course & { MODULE: ModuleContent[] }) | null);
}

export async function createCourse(
  supabase: DbClient,
  data: { course_name: string; course_description: string | null; event_id: number },
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

export async function findModuleById(supabase: DbClient, id: number): Promise<Module | null> {
  const { data } = await supabase.from("MODULE").select("*").eq("id", id).single();
  return data;
}

export async function createModule(
  supabase: DbClient,
  data: { course_id: number; module_name: string; sequence_order: number; module_type?: string },
): Promise<Module | null> {
  const insertData = { ...data, module_type: data.module_type ?? "lessons" };
  const { data: module, error } = await supabase.from("MODULE").insert(insertData).select("*").single();

  if (error) {
    console.error("course.dao.createModule failed:", error.message, error.code);
    return null;
  }
  return module;
}

export async function updateModule(
  supabase: DbClient,
  id: number,
  data: {
    module_name?: string;
    sequence_order?: number;
    is_locked?: boolean;
    start_time?: string | null;
    end_time?: string | null;
    speaker_profile_id?: number | null;
  },
): Promise<Module | null> {
  const { data: module, error } = await supabase.from("MODULE").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("course.dao.updateModule failed:", error.message, error.code);
    return null;
  }
  return module;
}

/**
 * Unassign a speaker from every module of an event's course. An event owns at
 * most one course, so the course is resolved first; no course is a no-op.
 */
export async function clearModuleSpeakerForEvent(
  supabase: DbClient,
  eventId: number,
  speakerProfileId: number,
): Promise<boolean> {
  const { data: course } = await supabase.from("COURSE").select("id").eq("event_id", eventId).maybeSingle();
  if (!course) return true;

  const { error } = await supabase
    .from("MODULE")
    .update({ speaker_profile_id: null })
    .eq("course_id", course.id)
    .eq("speaker_profile_id", speakerProfileId);
  return !error;
}

export async function setModuleLock(supabase: DbClient, id: number, is_locked: boolean): Promise<Module | null> {
  const { data: module, error } = await supabase
    .from("MODULE")
    .update({ is_locked, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("course.dao.setModuleLock failed:", error.message, error.code);
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
): Promise<{ id: number; event_id: number } | null> {
  const mod = await findModuleCourse(supabase, moduleId);
  if (!mod) return null;
  return findCourseEvent(supabase, mod.course_id);
}

export async function findCourseByLesson(
  supabase: DbClient,
  lessonId: number,
): Promise<{ id: number; event_id: number } | null> {
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
  // ever reconciled — see SPEC-01-COURSE-OWNERSHIP.
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
