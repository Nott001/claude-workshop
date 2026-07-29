import type { DbClient } from "./types";
import type { Event, User, SpeakerProfile } from "@/shared/types";

type CreateEventInput = Omit<Event, "id" | "created_at" | "updated_at">;
type UpdateEventInput = Partial<CreateEventInput>;

type EventWithCourseName = Event & { COURSE?: { id: number; course_name: string } | null };

type EventSpeakerJoin = {
  SPEAKER_PROFILE: SpeakerProfile & { USER: Pick<User, "full_name" | "email"> };
};
type EventWithRelations = Event & {
  COURSE?: Record<string, unknown> | null;
  EVENT_SPEAKER?: EventSpeakerJoin[];
};

export async function findById(supabase: DbClient, id: number): Promise<Event | null> {
  const { data } = await supabase.from("EVENT").select("*").eq("id", id).single();
  return data;
}

export async function findByIdWithCourse(supabase: DbClient, id: number): Promise<EventWithRelations | null> {
  const { data } = await supabase
    .from("EVENT")
    .select("*, COURSE!event_id(*), EVENT_SPEAKER(SPEAKER_PROFILE(*, USER(full_name, email)))")
    .eq("id", id)
    .single();
  return data;
}

export async function findByIdWithCourseName(supabase: DbClient, id: number): Promise<EventWithCourseName | null> {
  const { data } = await supabase.from("EVENT").select("*, COURSE!event_id(id, course_name)").eq("id", id).single();
  return data;
}

export async function list(
  supabase: DbClient,
  options?: {
    role?: string | null;
    filter?: string | null;
  },
): Promise<EventWithCourseName[]> {
  const { role, filter } = options ?? {};

  let query = supabase.from("EVENT").select("*, COURSE!event_id(course_name)").order("event_date", { ascending: true });

  if (role !== "facilitator") {
    query = query.in("status", ["active", "complete"]);
  }

  if (filter === "upcoming") {
    query = query.gte("event_date", new Date().toISOString().split("T")[0]);
  } else if (filter === "past") {
    query = query.lt("event_date", new Date().toISOString().split("T")[0]);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getUpcomingForLanding(supabase: DbClient): Promise<EventWithCourseName[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("EVENT")
    .select("*, COURSE!event_id(course_name)")
    .eq("status", "active")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(2);
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
