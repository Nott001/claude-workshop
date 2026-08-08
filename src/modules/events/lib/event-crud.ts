import { ROLES } from "@/shared/lib/roles";
import type { z } from "zod";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { eventSchema, eventPartialSchema } from "@/modules/events/lib/schemas";
import * as eventDao from "@/modules/events/db/event.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";
import type { EventActor } from "@/modules/events/lib/event-authz";

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
  if (user.role === ROLES.FACILITATOR && user.id != null) {
    const assigned = await facilitatorDao.isAssigned(supabase, id, user.id);
    if (!assigned) {
      throw new EventServiceError(404, "Event not found");
    }
  }

  if (event.status === "draft" && !hasMinRole(user.role, ROLES.FACILITATOR)) {
    throw new EventServiceError(404, "Event not found");
  }

  if (hasMinRole(user.role, ROLES.FACILITATOR)) {
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
