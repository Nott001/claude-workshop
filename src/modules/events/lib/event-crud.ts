import { ROLES } from "@/shared/lib/roles";
import type { z } from "zod";
import type { DbClient, PaginatedResult } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { seatsLeft } from "@/shared/lib/event-capacity";
import { redactMeetingUrl } from "@/modules/events/lib/meeting-link";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { eventSchema, eventPartialSchema } from "@/modules/events/lib/schemas";
import * as eventDao from "@/modules/events/db/event.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";
import type { EventActor } from "@/modules/events/lib/event-authz";

export type EventListRow = Awaited<ReturnType<typeof eventDao.list>>["data"][number] & { attendee_count?: number };

export async function listEvents(
  supabase: DbClient,
  options: {
    role: string | null;
    userId: number | null;
    filter: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
  },
): Promise<PaginatedResult<EventListRow>> {
  const result = await eventDao.list(supabase, options);
  // The list selects * and feeds the public listing and the landing page, so
  // the link would reach anyone who can see an event at all. No listing surface
  // renders it; the detail route serves it under `canSeeMeetingLink`.
  result.data = result.data.map((row) => redactMeetingUrl(row, false));

  // Only the staff table renders the Attendees column, and the same endpoint
  // feeds the public list and the landing page. Counting every caller's tickets
  // would leak attendance numbers and pay for a TICKET scan on every public
  // render, so the join is limited to staff.
  if (!hasMinRole((options.role ?? null) as UserRole | null, ROLES.FACILITATOR) || result.data.length === 0) {
    return result;
  }

  const counts = await eventDao.getAttendeeCounts(
    supabase,
    result.data.map((row) => row.id),
  );

  return { ...result, data: result.data.map((row) => ({ ...row, attendee_count: counts[row.id] ?? 0 })) };
}

export async function createEvent(supabase: DbClient, input: z.infer<typeof eventSchema>, actor: EventActor): Promise<Event> {
  const event = await eventDao.create(supabase, {
    title: input.title,
    event_date: input.event_date,
    start_time: input.start_time,
    end_time: input.end_time,
    venue_name: input.venue_name,
    event_type: input.event_type ?? "onsite",
    venue_address: input.venue_address ?? null,
    meeting_url: input.meeting_url ?? null,
    description: input.description ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "PHP",
    cover_image_url: input.cover_image_url ?? null,
    capacity: input.capacity ?? null,
    status: "draft",
    survey_enabled: input.survey_enabled ?? false,
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

  await requireAuditEvent(supabase, actor.id, "event.created", "event", event.id, {
    title: event.title,
    facilitator_ids: facilitatorIds.length > 0 ? facilitatorIds : undefined,
    speaker_profile_ids: speakerProfileIds.length > 0 ? speakerProfileIds : undefined,
  });

  return event;
}

type EventDetail = NonNullable<Awaited<ReturnType<typeof eventDao.findByIdWithCourse>>> & {
  /** Null for an uncapped event; see `seatsLeft`. */
  seats_left: number | null;
};
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

  const staff = hasMinRole(user.role, ROLES.FACILITATOR);

  // A capped event has to answer "how many seats are left" for everyone,
  // because the register card is what refuses a sold-out event and it renders
  // for a signed-out reader. An uncapped event pays for no count at all, and
  // staff reuse the one the Attendees figure already needs.
  const attendeeCount = staff || event.capacity != null ? await eventDao.getAttendeeCount(supabase, id) : 0;
  const seats_left = seatsLeft(event.capacity, attendeeCount);

  if (staff) {
    return {
      ...event,
      seats_left,
      attendee_count: attendeeCount,
      facilitator_ids: (event.EVENT_FACILITATOR ?? []).map((f) => f.user_id),
      speaker_profile_ids: (event.EVENT_SPEAKER ?? []).map((es) => es.speaker_profile_id),
    };
  }

  return { ...event, seats_left };
}

export async function updateEvent(
  supabase: DbClient,
  id: number,
  input: z.infer<typeof eventPartialSchema>,
  actor: EventActor,
): Promise<Event> {
  // Two rules span the patch and the stored row, and both are constraints in
  // the database, so a patch carrying only one half of either would come back
  // as a 500 where a 400 belongs. One read answers both.
  const movesTimes = input.start_time !== undefined || input.end_time !== undefined;
  // An address or a link on a patch that does not also name a mode has to be
  // checked against the mode already stored — each is legal under one mode and
  // refused under the other.
  const addsAddress = input.venue_address != null && input.event_type === undefined;
  const addsLink = input.meeting_url != null && input.event_type === undefined;

  if (movesTimes || addsAddress || addsLink) {
    const current = await eventDao.findById(supabase, id);
    if (!current) {
      throw new EventServiceError(404, "Event not found");
    }

    if (movesTimes) {
      const startTime = input.start_time ?? current.start_time;
      const endTime = input.end_time ?? current.end_time;
      if (startTime >= endTime) {
        throw new EventServiceError(400, "start_time must be before end_time");
      }
    }

    if (addsAddress && current.event_type === "online") {
      throw new EventServiceError(400, "An online event cannot have a venue address");
    }

    if (addsLink && current.event_type !== "online") {
      throw new EventServiceError(400, "Only an online event can have a meeting link");
    }
  }

  // facilitator_ids and speaker_profile_ids are not EVENT columns; they are
  // synced to their join tables so they must not reach the EVENT update.
  const { facilitator_ids, speaker_profile_ids, ...eventFields } = input;

  // Turning an event online drops its address in the same write. The form
  // disables that input rather than emptying it, so without this the stored
  // street address survives the switch — and chk_event_online_has_no_address
  // would reject the row anyway.
  if (eventFields.event_type === "online") {
    eventFields.venue_address = null;
  }

  // And the mirror: an onsite event holds no meeting link. Without this,
  // switching back would leave a live URL on the row — invisible, because
  // nothing renders a link for an onsite event, and still a working door.
  if (eventFields.event_type === "onsite") {
    eventFields.meeting_url = null;
  }

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

  await requireAuditEvent(supabase, actor.id, "event.updated", "event", id, {
    changes: Object.keys(input),
  });

  return event;
}

/**
 * Set or clear an online event's meeting link, and nothing else.
 *
 * Separate from `updateEvent` because it answers to a different capability:
 * editing an event is admin-only, while the link is set by whoever is running
 * the session on the day. A facilitator reaching this cannot touch the price,
 * the date, or anything else on the row.
 */
export async function setMeetingLink(
  supabase: DbClient,
  id: number,
  meetingUrl: string | null,
  actor: EventActor,
): Promise<Event> {
  const current = await eventDao.findById(supabase, id);

  if (!current) {
    throw new EventServiceError(404, "Event not found");
  }

  // chk_event_meeting_url_online_only would refuse this anyway; catching it
  // here is the difference between a 400 that explains itself and a 500.
  if (current.event_type !== "online") {
    throw new EventServiceError(400, "Only an online event can have a meeting link");
  }

  const event = await eventDao.update(supabase, id, { meeting_url: meetingUrl });

  if (!event) {
    throw new EventServiceError(500, "Failed to update meeting link");
  }

  // The URL itself stays out of the audit metadata. An audit row is readable by
  // every admin and is exactly the sort of place a working door gets left lying
  // around; that it changed, and who changed it, is the part worth keeping.
  await requireAuditEvent(supabase, actor.id, "event.updated", "event", id, {
    changes: ["meeting_url"],
    cleared: meetingUrl === null,
  });

  return event;
}

export async function publishEvent(supabase: DbClient, id: number, actor: EventActor): Promise<void> {
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

  await requireAuditEvent(supabase, actor.id, "event.published", "event", id);
}
