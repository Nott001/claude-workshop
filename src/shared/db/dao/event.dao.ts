import type { DbClient } from "./types";
import type { Event, User, SpeakerProfile, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { isEventFinished } from "@/shared/lib/date-utils";

type CreateEventInput = Omit<Event, "id" | "created_at" | "updated_at">;
type UpdateEventInput = Partial<CreateEventInput>;

type EventWithCourseName = Event & { COURSE?: { id: number; course_name: string } | null };

// The status column is only ever advanced to "active" by the publish flow, so a
// past event lingers there forever and the UI has to lie about it. Every read
// path that surfaces status derives the effective value instead: once an
// active event's end time has passed it is served as complete.
function effectiveStatus(event: Pick<Event, "event_date" | "start_time" | "end_time" | "status">): Event["status"] {
  if (event.status === "active" && isEventFinished(event.event_date, event.end_time)) {
    return "complete";
  }
  return event.status;
}

type EventSpeakerJoin = {
  speaker_profile_id: number;
  SPEAKER_PROFILE: SpeakerProfile & { USER: Pick<User, "full_name" | "email"> };
};
type EventWithRelations = Event & {
  COURSE?: Record<string, unknown> | null;
  EVENT_SPEAKER?: EventSpeakerJoin[];
  EVENT_FACILITATOR?: { user_id: number }[];
};

export async function findById(supabase: DbClient, id: number): Promise<Event | null> {
  const { data } = await supabase.from("EVENT").select("*").eq("id", id).single();
  return data;
}

export async function findByIdWithCourse(supabase: DbClient, id: number): Promise<EventWithRelations | null> {
  const { data } = await supabase
    .from("EVENT")
    .select(
      "*, COURSE!event_id(*), EVENT_SPEAKER(speaker_profile_id, SPEAKER_PROFILE(*, USER(full_name, email))), EVENT_FACILITATOR(user_id)",
    )
    .eq("id", id)
    .single();
  return data ? { ...data, status: effectiveStatus(data) } : null;
}

export async function findByIdWithCourseName(supabase: DbClient, id: number): Promise<EventWithCourseName | null> {
  const { data } = await supabase.from("EVENT").select("*, COURSE!event_id(id, course_name)").eq("id", id).single();
  return data ? { ...data, status: effectiveStatus(data) } : null;
}

export async function list(
  supabase: DbClient,
  options?: {
    role?: string | null;
    userId?: number | null;
    filter?: string | null;
  },
): Promise<EventWithCourseName[]> {
  const { role, userId, filter } = options ?? {};

  let query = supabase.from("EVENT").select("*, COURSE!event_id(course_name)").order("event_date", { ascending: true });

  // A facilitator's dashboard shows only the events they are assigned to;
  // admins and every other role keep the full listing.
  if (role === "facilitator" && userId != null) {
    const { data: assigned } = await supabase.from("EVENT_FACILITATOR").select("event_id").eq("user_id", userId);
    const assignedIds = (assigned ?? []).map((row: { event_id: number }) => row.event_id);
    // PostgREST treats an empty in() as vacuous, so an unassigned facilitator
    // would otherwise get every event.
    query = query.in("id", assignedIds.length > 0 ? assignedIds : [-1]);
  }

  // Drafts are staff-only, and "staff" is facilitator *and up* — a literal
  // inequality hid every draft from admins, who are the only role allowed to
  // create one.
  if (!hasMinRole((role ?? null) as UserRole | null, "facilitator")) {
    query = query.in("status", ["active", "complete"]);
  }

  if (filter === "upcoming") {
    query = query.gte("event_date", new Date().toISOString().split("T")[0]);
  } else if (filter === "past") {
    query = query.lt("event_date", new Date().toISOString().split("T")[0]);
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({ ...row, status: effectiveStatus(row) }));
}

export async function getUpcomingForLanding(supabase: DbClient): Promise<EventWithCourseName[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("EVENT")
    .select("*")
    .eq("status", "active")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(2);
  // Without this the landing page renders "No upcoming events" identically
  // whether there are none or the query failed. It reads as anon, which is
  // granted SELECT on EVENT and nothing else — an embed here (COURSE used to
  // be one) fails the whole query with 42501 rather than returning partial rows.
  if (error) {
    console.error("event.dao.getUpcomingForLanding failed:", error.message, error.code);
  }
  return data ?? [];
}

export async function create(supabase: DbClient, data: CreateEventInput): Promise<Event | null> {
  const { data: event, error } = await supabase.from("EVENT").insert(data).select("*").single();

  if (error) {
    console.error("event.dao.create failed:", error.message, error.code);
    return null;
  }
  return event;
}

export async function update(supabase: DbClient, id: number, data: UpdateEventInput): Promise<Event | null> {
  const { data: event, error } = await supabase.from("EVENT").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("event.dao.update failed:", error.message, error.code);
    return null;
  }
  return event;
}

type EventUpdatableField =
  | "title"
  | "event_date"
  | "start_time"
  | "end_time"
  | "venue_name"
  | "venue_address"
  | "description"
  | "price"
  | "currency"
  | "cover_image_url"
  | "status";

export async function updateField(
  supabase: DbClient,
  id: number,
  field: EventUpdatableField,
  value: unknown,
): Promise<boolean> {
  const { error } = await supabase
    .from("EVENT")
    .update({ [field]: value })
    .eq("id", id);
  return !error;
}

export async function remove(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("EVENT").delete().eq("id", id);
  return !error;
}

export async function exists(supabase: DbClient, id: number): Promise<boolean> {
  const { data } = await supabase.from("EVENT").select("id").eq("id", id).single();
  return !!data;
}

/**
 * Whether the event is visible to someone with no session — the same
 * active/complete rule `list` applies to non-staff. Selects one column because
 * the storage route calls it per cover image request.
 */
export async function isPublished(supabase: DbClient, id: number): Promise<boolean> {
  const { data } = await supabase.from("EVENT").select("status").eq("id", id).single();
  return data?.status === "active" || data?.status === "complete";
}

export async function getAttendeeCount(supabase: DbClient, eventId: number): Promise<number> {
  const { count } = await supabase
    .from("TICKET")
    .select("payment_id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");
  return count ?? 0;
}

export async function findByIds(supabase: DbClient, ids: number[]): Promise<EventWithCourseName[]> {
  const { data } = await supabase
    .from("EVENT")
    .select("*, COURSE!event_id(course_name)")
    .in("id", ids)
    .order("event_date", { ascending: true });
  return data ?? [];
}
