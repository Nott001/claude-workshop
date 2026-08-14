import { ROLES } from "@/shared/lib/roles";
import type { DbClient, PaginatedResult } from "@/shared/db/dao/types";
import type { Event, User, SpeakerProfile, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { effectiveEventStatus, pageBounds, throwOnDbError } from "@/shared/db/dao/helpers";
import { localDateString, localTimeString } from "@/shared/lib/date-utils";

type CreateEventInput = Omit<Event, "id" | "created_at" | "updated_at">;
type UpdateEventInput = Partial<CreateEventInput>;

type EventWithCourseName = Event & { COURSE?: { id: number; course_name: string } | null };

type EventSpeakerJoin = {
  speaker_profile_id: number;
  SPEAKER_PROFILE: SpeakerProfile & { USER: Pick<User, "full_name" | "email" | "profile_image_url"> };
};
type EventWithRelations = Event & {
  COURSE?: Record<string, unknown> | null;
  EVENT_SPEAKER?: EventSpeakerJoin[];
  EVENT_FACILITATOR?: { user_id: number }[];
};

export async function findById(supabase: DbClient, id: number): Promise<Event | null> {
  const { data, error } = await supabase.from("EVENT").select("*").eq("id", id).maybeSingle();
  throwOnDbError(error, "event.dao.findById");
  return data ? { ...data, status: effectiveEventStatus(data) } : null;
}

export async function findByIdWithCourse(supabase: DbClient, id: number): Promise<EventWithRelations | null> {
  const { data, error } = await supabase
    .from("EVENT")
    .select(
      "*, COURSE!event_id(*), EVENT_SPEAKER(speaker_profile_id, SPEAKER_PROFILE(*, USER(full_name, email, profile_image_url))), EVENT_FACILITATOR(user_id)",
    )
    .eq("id", id)
    .maybeSingle();
  throwOnDbError(error, "event.dao.findByIdWithCourse");
  return data ? { ...data, status: effectiveEventStatus(data) } : null;
}

export async function findByIdWithCourseName(supabase: DbClient, id: number): Promise<EventWithCourseName | null> {
  const { data, error } = await supabase.from("EVENT").select("*, COURSE!event_id(id, course_name)").eq("id", id).maybeSingle();
  throwOnDbError(error, "event.dao.findByIdWithCourseName");
  return data ? { ...data, status: effectiveEventStatus(data) } : null;
}

export async function list(
  supabase: DbClient,
  options?: {
    role?: string | null;
    userId?: number | null;
    filter?: string | null;
    page?: number;
    limit?: number;
  },
): Promise<PaginatedResult<EventWithCourseName>> {
  const { role, userId, filter } = options ?? {};
  const { from, to, page, limit } = pageBounds(options);

  let query = supabase.from("EVENT").select("*, COURSE!event_id(course_name)", { count: "exact" });

  // A facilitator's dashboard shows only the events they are assigned to;
  // admins and every other role keep the full listing.
  if (role === ROLES.FACILITATOR && userId != null) {
    const { data: assigned } = await supabase.from("EVENT_FACILITATOR").select("event_id").eq("user_id", userId);
    const assignedIds = (assigned ?? []).map((row: { event_id: number }) => row.event_id);
    // PostgREST treats an empty in() as vacuous, so an unassigned facilitator
    // would otherwise get every event.
    query = query.in("id", assignedIds.length > 0 ? assignedIds : [-1]);
  }

  // Drafts are staff-only, and "staff" is facilitator *and up* — a literal
  // inequality hid every draft from admins, who are the only role allowed to
  // create one.
  if (!hasMinRole((role ?? null) as UserRole | null, ROLES.FACILITATOR)) {
    query = query.in("status", ["active", "complete"]);
  }

  if (filter === "upcoming") {
    // An event is still upcoming while its end edge is in the future, not
    // merely while its date has not passed — otherwise a session that ended
    // an hour ago keeps a seat on the landing page until midnight. Same
    // local-clock convention as isEventFinished.
    const now = new Date();
    query = query.or(
      `event_date.gt.${localDateString(now)},and(event_date.eq.${localDateString(now)},end_time.gte.${localTimeString(now)})`,
    );
  } else if (filter === "past") {
    // The exact complement of "upcoming", on the same local clock. Comparing
    // `event_date` against a UTC day boundary disagreed with isEventFinished
    // twice over: it kept a session that ended this morning out of the archive
    // until midnight, and west of UTC it dropped in a day early.
    const now = new Date();
    query = query.or(
      `event_date.lt.${localDateString(now)},and(event_date.eq.${localDateString(now)},end_time.lt.${localTimeString(now)})`,
    );
  }

  // An archive is read backwards from the most recent session; every other
  // listing reads forwards from the next one.
  query = query.order("event_date", { ascending: filter !== "past" }).range(from, to);

  const { data, count } = await query;
  return {
    data: (data ?? []).map((row) => ({ ...row, status: effectiveEventStatus(row) })),
    total: count ?? 0,
    page,
    limit,
  };
}

export async function getUpcomingForLanding(supabase: DbClient): Promise<EventWithCourseName[]> {
  const now = new Date();
  const { data, error } = await supabase
    .from("EVENT")
    .select("*")
    .eq("status", "active")
    .or(`event_date.gt.${localDateString(now)},and(event_date.eq.${localDateString(now)},end_time.gte.${localTimeString(now)})`)
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

/**
 * Per-event attendee counts for a whole listing in one query. PostgREST has no
 * GROUP BY, so the id column is fetched for every non-cancelled ticket and
 * tallied here; an empty id set short-circuits so an empty list never scans.
 */
export async function getAttendeeCounts(supabase: DbClient, eventIds: number[]): Promise<Record<number, number>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await supabase.from("TICKET").select("event_id").in("event_id", eventIds).neq("status", "cancelled");
  throwOnDbError(error, "event.dao.getAttendeeCounts");
  const counts: Record<number, number> = {};
  for (const row of data ?? []) {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  }
  return counts;
}

export async function findByIds(supabase: DbClient, ids: number[]): Promise<EventWithCourseName[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("EVENT")
    .select("*, COURSE!event_id(course_name)")
    .in("id", ids)
    .order("event_date", { ascending: true });
  return data ?? [];
}
