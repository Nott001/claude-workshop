import type { z } from "zod";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { eventSchema, eventPartialSchema } from "@/modules/events/lib/schemas";
import * as eventDao from "@/modules/events/db/event.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import type { StorageBucket } from "@/shared/integrations/storage/policy";

/**
 * A domain failure with the status the HTTP layer should answer with. The
 * routes distinguish 404 (hidden/missing), 400 (draft/range violations), 409
 * (already registered) and 500 (write/assignment failures); throwing one of
 * these keeps that contract without dragging HTTP types into the service.
 */
export class EventServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EventServiceError";
    this.status = status;
  }
}

export type EventActor = { id: number };

export async function listEvents(
  supabase: DbClient,
  options: { role: string | null; userId: number | null; filter: string | null },
): Promise<Awaited<ReturnType<typeof eventDao.list>>> {
  return eventDao.list(supabase, options);
}

export async function createEvent(supabase: DbClient, input: z.infer<typeof eventSchema>, actor: EventActor): Promise<Event> {
  const event = await eventDao.create(supabase, {
    title: input.title,
    event_date: input.event_date,
    start_time: input.start_time,
    end_time: input.end_time,
    venue_name: input.venue_name,
    venue_address: input.venue_address ?? null,
    description: input.description ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "PHP",
    cover_image_url: input.cover_image_url ?? null,
    status: "draft",
  });

  if (!event) {
    throw new EventServiceError(500, "Failed to create event");
  }

  const facilitatorIds = input.facilitator_ids ?? [];
  if (facilitatorIds.length > 0) {
    const assigned = await facilitatorDao.replaceEventAssignments(supabase, event.id, facilitatorIds, actor.id);
    if (!assigned) {
      throw new EventServiceError(500, "Failed to assign facilitators");
    }
  }

  const speakerProfileIds = input.speaker_profile_ids ?? [];
  if (speakerProfileIds.length > 0) {
    const assigned = await speakerDao.replaceEventAssignments(supabase, event.id, speakerProfileIds);
    if (!assigned) {
      throw new EventServiceError(500, "Failed to assign speakers");
    }
  }

  await logAuditEvent(supabase, actor.id, "event.created", "event", event.id, {
    title: event.title,
    facilitator_ids: facilitatorIds.length > 0 ? facilitatorIds : undefined,
    speaker_profile_ids: speakerProfileIds.length > 0 ? speakerProfileIds : undefined,
  });

  return event;
}

type EventDetail = NonNullable<Awaited<ReturnType<typeof eventDao.findByIdWithCourse>>>;
type StaffEventDetail = EventDetail & {
  attendee_count: number;
  facilitator_ids: number[];
  speaker_profile_ids: number[];
};

export async function getEvent(
  supabase: DbClient,
  id: number,
  user: { id: number | null; role: UserRole | null },
): Promise<EventDetail | StaffEventDetail> {
  const event = await eventDao.findByIdWithCourse(supabase, id);

  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  // A facilitator's detail view is restricted to the events they are assigned
  // to, so a direct URL cannot bypass the dashboard's filtering.
  if (user.role === "facilitator" && user.id != null) {
    const assigned = await facilitatorDao.isAssigned(supabase, id, user.id);
    if (!assigned) {
      throw new EventServiceError(404, "Event not found");
    }
  }

  if (event.status === "draft" && !hasMinRole(user.role, "facilitator")) {
    throw new EventServiceError(404, "Event not found");
  }

  if (hasMinRole(user.role, "facilitator")) {
    const attendeeCount = await eventDao.getAttendeeCount(supabase, id);
    return {
      ...event,
      attendee_count: attendeeCount,
      facilitator_ids: (event.EVENT_FACILITATOR ?? []).map((f) => f.user_id),
      speaker_profile_ids: (event.EVENT_SPEAKER ?? []).map((es) => es.speaker_profile_id),
    };
  }

  return event;
}

export async function updateEvent(
  supabase: DbClient,
  id: number,
  input: z.infer<typeof eventPartialSchema>,
  actor: EventActor,
): Promise<Event> {
  // A patch that moves only one end of the range still has to be checked
  // against the end it leaves alone, otherwise chk_event_time rejects it in the
  // database and the caller gets a 500 where a 400 belongs.
  if (input.start_time !== undefined || input.end_time !== undefined) {
    const current = await eventDao.findById(supabase, id);
    if (!current) {
      throw new EventServiceError(404, "Event not found");
    }
    const startTime = input.start_time ?? current.start_time;
    const endTime = input.end_time ?? current.end_time;
    if (startTime >= endTime) {
      throw new EventServiceError(400, "start_time must be before end_time");
    }
  }

  // facilitator_ids and speaker_profile_ids are not EVENT columns; they are
  // synced to their join tables so they must not reach the EVENT update.
  const { facilitator_ids, speaker_profile_ids, ...eventFields } = input;

  if (facilitator_ids !== undefined) {
    const synced = await facilitatorDao.replaceEventAssignments(supabase, id, facilitator_ids, actor.id);
    if (!synced) {
      throw new EventServiceError(500, "Failed to update facilitators");
    }
  }

  if (speaker_profile_ids !== undefined) {
    const synced = await speakerDao.replaceEventAssignments(supabase, id, speaker_profile_ids);
    if (!synced) {
      throw new EventServiceError(500, "Failed to update speakers");
    }
  }

  const event = await eventDao.update(supabase, id, eventFields);

  if (!event) {
    throw new EventServiceError(500, "Failed to update event");
  }

  await logAuditEvent(supabase, actor.id, "event.updated", "event", id, {
    changes: Object.keys(input),
  });

  return event;
}

export async function deleteEvent(supabase: DbClient, id: number, actor: EventActor): Promise<{ success: true }> {
  const event = await eventDao.findById(supabase, id);

  // Collected before deletion, and kept per bucket: a path is only meaningful
  // to the bucket it was listed from, so one flat list cannot be deleted from.
  const pathsByBucket: Record<"event_images" | "course_assets" | "course_videos", string[]> = {
    event_images: [],
    course_assets: [],
    course_videos: [],
  };

  if (event?.cover_image_url) {
    pathsByBucket.event_images.push(...(await listStorageFolder("event_images", `events/${id}`)));
  }

  if (event?.id) {
    const { data: linkedCourse } = await supabase.from("COURSE").select("id").eq("event_id", event.id).maybeSingle();

    if (linkedCourse) {
      const modules = await courseDao.findModulesByCourse(supabase, linkedCourse.id);
      for (const mod of modules) {
        const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
        for (const lesson of lessons) {
          const folder = `courses/${linkedCourse.id}/modules/${mod.id}/lessons/${lesson.id}`;
          const [assetPaths, videoPaths] = await Promise.all([
            listStorageFolder("course_assets", folder),
            listStorageFolder("course_videos", folder),
          ]);
          pathsByBucket.course_assets.push(...assetPaths);
          pathsByBucket.course_videos.push(...videoPaths);
        }
      }
    }
  }

  // Delete event row first (FK cascades handle payments, tickets)
  const removed = await eventDao.remove(supabase, id);

  if (!removed) {
    throw new EventServiceError(500, "Failed to delete event");
  }

  // Best-effort storage cleanup
  try {
    await Promise.all(
      Object.entries(pathsByBucket).map(([bucket, paths]) => deleteFromStorage(bucket as StorageBucket, paths)),
    );
  } catch {
    // Storage cleanup is best-effort
  }

  await logAuditEvent(supabase, actor.id, "event.deleted", "event", id, {
    title: event?.title,
  });

  return { success: true };
}

export async function publishEvent(supabase: DbClient, id: number, actor: EventActor): Promise<{ success: true }> {
  const event = await eventDao.findById(supabase, id);

  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (event.status !== "draft") {
    throw new EventServiceError(400, "Only draft events can be published");
  }

  const ok = await eventDao.updateField(supabase, id, "status", "active");

  if (!ok) {
    throw new EventServiceError(500, "Failed to publish event");
  }

  await logAuditEvent(supabase, actor.id, "event.published", "event", id);

  return { success: true };
}

export async function getEventRegistrationState(
  supabase: DbClient,
  id: number,
  user: { id: number; role: UserRole; full_name: string; email: string },
): Promise<{ event: Event; user: { user_id: number; full_name: string; email: string }; already_registered: boolean }> {
  const event = await eventDao.findById(supabase, id);

  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (event.status === "draft" && !hasMinRole(user.role, "facilitator")) {
    throw new EventServiceError(404, "Event not found");
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, user.id, id);

  return {
    event,
    user: { user_id: user.id, full_name: user.full_name, email: user.email },
    already_registered: activeTickets.length > 0,
  };
}

export async function registerForEvent(
  supabase: DbClient,
  id: number,
  user: { id: number; role: UserRole },
): Promise<{ eligible: true; pending_payment_id?: number }> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (event.status === "draft" && !hasMinRole(user.role, "facilitator")) {
    throw new EventServiceError(404, "Event not found");
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, user.id, id);

  if (activeTickets.length > 0) {
    throw new EventServiceError(409, "You already have an active ticket for this event");
  }

  const existingPending = await paymentDao.findPendingByUserAndEvent(supabase, user.id, id);

  if (existingPending) {
    return { eligible: true, pending_payment_id: existingPending.id };
  }

  return { eligible: true };
}

export interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

export async function listEventAttendees(
  supabase: DbClient,
  eventId: number,
  options: { search: string; status: string; page: number; limit: number },
): Promise<{ attendees: AttendeeRow[]; total: number; page: number; limit: number }> {
  const { search, status, page, limit } = options;

  const { data: rawAttendees, total } = await ticketDao.getAttendees(supabase, eventId, {
    search,
    status,
    page,
    limit,
  });

  const attendees: AttendeeRow[] = (
    (rawAttendees ?? []) as {
      USER: { id: number; full_name: string; email: string } | null;
      status: string;
      issued_at: string;
      updated_at: string;
    }[]
  ).map((row) => ({
    user_id: row.USER?.id ?? 0,
    full_name: row.USER?.full_name ?? "Unknown",
    email: row.USER?.email ?? "",
    ticket_status: row.status as AttendeeRow["ticket_status"],
    issued_at: row.issued_at,
    checked_in_at: row.status === "checked_in" ? row.updated_at : null,
  }));

  return { attendees, total, page, limit };
}

export async function getEventHighlight(
  supabase: DbClient,
  id: number,
): Promise<{
  highlighted_lesson_id: number | null;
  updated_by: number | null;
  updated_at: string | null;
  lesson: unknown;
}> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  const { data: state } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("*, LESSON(id, description, content_type)")
    .eq("event_id", id)
    .single();

  if (!state) {
    return { highlighted_lesson_id: null, updated_by: null, updated_at: null, lesson: null };
  }

  return {
    highlighted_lesson_id: state.highlighted_lesson_id,
    updated_by: state.updated_by,
    updated_at: state.updated_at,
    lesson: state.LESSON ?? null,
  };
}

export async function setEventHighlight(
  supabase: DbClient,
  id: number,
  lessonId: number | null,
  actor: EventActor,
): Promise<unknown> {
  const event = await eventDao.findById(supabase, id);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  if (lessonId !== null) {
    const lesson = await courseDao.findLessonById(supabase, lessonId);

    if (!lesson) {
      throw new EventServiceError(404, "Lesson not found");
    }

    const mod = await courseDao.findModuleById(supabase, lesson.module_id);

    const { data: eventCourse } = await supabase.from("COURSE").select("id").eq("event_id", id).maybeSingle();

    if (!mod || !eventCourse || mod.course_id !== eventCourse.id) {
      throw new EventServiceError(400, "Lesson does not belong to this event's course");
    }
  }

  const { data: state, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      {
        event_id: id,
        highlighted_lesson_id: lessonId,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )
    .select()
    .single();

  if (error) {
    throw new EventServiceError(500, error.message);
  }

  return state;
}

export async function clearEventHighlight(
  supabase: DbClient,
  id: number,
  actor: EventActor,
): Promise<{ highlighted_lesson_id: null }> {
  const { error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert(
      {
        event_id: id,
        highlighted_lesson_id: null,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )
    .select()
    .single();

  if (error) {
    throw new EventServiceError(500, error.message);
  }

  return { highlighted_lesson_id: null };
}
