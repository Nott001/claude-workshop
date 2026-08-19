import { ROLES } from "@/shared/lib/roles";
import type { DbClient, PaginatedResult } from "@/shared/db/dao/types";
import type { Event, User, SpeakerProfile, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { effectiveEventStatus, ilikePattern, pageBounds, throwOnDbError } from "@/shared/db/dao/helpers";
import { eventZoneDate, eventZoneTime } from "@/shared/lib/date-utils";

type CreateEventInput = Omit<Event, "id" | "created_at" | "updated_at">;
type UpdateEventInput = Partial<CreateEventInput>;

type EventWithCourseName = Event & { COURSE?: { id: number; course_name: string } | null };

/**
 * The columns the listing actually renders.
 *
 * `select("*")` here shipped the whole row to every caller — description, price,
 * currency, survey_enabled and the timestamps among them — for Postgres to
 * serialise, the Worker to parse and re-serialise, and the client to discard.
 * This is the widest read in the app, so it is the one place that saving is
 * worth naming columns for.
 *
 * `meeting_url` is deliberately absent, and must stay absent: the listing feeds
 * the public event list and the landing page, so a link selected here would
 * reach anyone who can see an event at all. Leaving it unselected makes that
 * structural — `EventListColumns` has no such field for a caller to read —
 * where a redaction step after the fact only held while someone remembered it.
 */
const LIST_SELECT =
  "id, title, event_date, start_time, end_time, venue_name, venue_address, status, event_type, cover_image_url, capacity, COURSE!event_id(course_name)";

// Spelled out rather than derived from LIST_SELECT: the generated client parses
// the select string as a type literal, so it has to stay one. event-dao-list-columns
// asserts the two agree, which is the guard against them drifting apart.
type EventListRow = Pick<
  Event,
  | "id"
  | "title"
  | "event_date"
  | "start_time"
  | "end_time"
  | "venue_name"
  | "venue_address"
  | "status"
  | "event_type"
  | "cover_image_url"
  | "capacity"
> & { COURSE?: { course_name: string } | null };

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
    /** The `status` column values a listing accepts, narrowing the role guard below. */
    statuses?: string[] | null;
    search?: string | null;
    page?: number;
    limit?: number;
  },
): Promise<PaginatedResult<EventListRow>> {
  const { role, userId, filter, statuses, search } = options ?? {};
  const { from, to, page, limit } = pageBounds(options);

  let query = supabase.from("EVENT").select(LIST_SELECT, { count: "exact" });

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

  // Applied after the role guard above, so a caller who may not see drafts asking
  // for them narrows an already-draftless set to nothing rather than widening it.
  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  if (filter === "upcoming") {
    // An event is still upcoming while its end edge is in the future, not
    // merely while its date has not passed — otherwise a session that ended
    // an hour ago keeps a seat on the landing page until midnight. Same
    // app-timezone convention as isEventFinished.
    const now = new Date();
    query = query.or(
      `event_date.gt.${eventZoneDate(now)},and(event_date.eq.${eventZoneDate(now)},end_time.gte.${eventZoneTime(now)})`,
    );
  } else if (filter === "past") {
    // The exact complement of "upcoming", on the same app-timezone clock. Comparing
    // `event_date` against a UTC day boundary disagreed with isEventFinished
    // twice over: it kept a session that ended this morning out of the archive
    // until midnight, and west of UTC it dropped in a day early.
    const now = new Date();
    query = query.or(
      `event_date.lt.${eventZoneDate(now)},and(event_date.eq.${eventZoneDate(now)},end_time.lt.${eventZoneTime(now)})`,
    );
  }

  // Title/venue search, only when a term is present. ilikePattern quotes and
  // escapes the term so a comma, paren, percent or underscore in user input
  // cannot rewrite the or() filter. Applies before the range bounds so staff
  // search is correct against the whole event set, not just the fetched page.
  if (search) {
    query = query.or(`title.ilike.${ilikePattern(search)},venue_name.ilike.${ilikePattern(search)}`);
  }

  // An archive is read backwards from the most recent session; every other
  // listing reads forwards from the next one.
  query = query.order("event_date", { ascending: filter !== "past" }).range(from, to);

  const { data, count } = await query;
  return {
    // COURSE.event_id carries a UNIQUE constraint, so the embed answers with one
    // course or null — but the generated types model only the foreign key and
    // infer an array. Every consumer reads `COURSE.course_name` directly and has
    // always been right to; naming the columns is what made the parser confident
    // enough to disagree. The cast keeps that reading, and the shape it asserts
    // is the one `EventListRow` declares.
    data: (data ?? []).map((row) => ({ ...row, status: effectiveEventStatus(row) })) as unknown as EventListRow[],
    total: count ?? 0,
    page,
    limit,
  };
}

/** One full row of the landing grid, which is three cards wide at `lg`. Asking
 *  for fewer left a ragged half-row on every desktop viewport. */
const LANDING_EVENT_LIMIT = 3;

/** The strip's rows plus how many upcoming events exist in total, so the page
 *  can decide whether "See all events" has anything to offer. */
export interface LandingEvents {
  events: EventWithCourseName[];
  total: number;
}

export async function getUpcomingForLanding(supabase: DbClient): Promise<LandingEvents> {
  const now = new Date();
  // `count: "exact"` counts the whole filtered set, not the limited page, which
  // is the only way to tell three-of-three from three-of-twelve.
  const { data, count, error } = await supabase
    .from("EVENT")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .or(`event_date.gt.${eventZoneDate(now)},and(event_date.eq.${eventZoneDate(now)},end_time.gte.${eventZoneTime(now)})`)
    .order("event_date", { ascending: true })
    .limit(LANDING_EVENT_LIMIT);
  // Without this the landing page renders "No upcoming events" identically
  // whether there are none or the query failed. It reads as anon, which is
  // granted SELECT on EVENT and nothing else — an embed here (COURSE used to
  // be one) fails the whole query with 42501 rather than returning partial rows.
  if (error) {
    console.error("event.dao.getUpcomingForLanding failed:", error.message, error.code);
  }
  return { events: data ?? [], total: count ?? 0 };
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
