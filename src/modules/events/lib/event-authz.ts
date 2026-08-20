import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import * as eventDao from "@/modules/events/db/event.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";

export type EventActor = { id: number };

export type EventGuardUser = { id: number; role: UserRole };

export type EventCapability =
  "edit" | "delete" | "publish" | "attendees" | "attendees_manage" | "survey" | "meeting_link" | "photos";

// Courses keeps its own copy: the module boundary forbids courses → events, so
// the course-room guard (SPEC-05) cannot import this one.
export async function canManageEvent(supabase: DbClient, user: EventGuardUser, eventId: number): Promise<boolean> {
  if (hasMinRole(user.role, ROLES.ADMIN)) return true;
  if (user.role === ROLES.FACILITATOR) return facilitatorDao.isAssigned(supabase, eventId, user.id);
  if (user.role === ROLES.SPEAKER) return speakerDao.isAssignedByUserId(supabase, user.id, eventId);
  return false;
}

// The capability matrix — the single source of truth. Event management (edit,
// publish, delete) and surveys are admin-only: facilitators are foot soldiers
// who run kiosk check-in but never touch event details. Only the attendee read
// stays open to an assigned facilitator, since the kiosk flow depends on it.
// The admin attendee table is a step further — it mutates registrations
// (check-in, cancel, resend) — so facilitators are shut out of it entirely.
const CAPABILITY_RULE: Record<EventCapability, { minRole: UserRole; assignment: boolean }> = {
  edit: { minRole: ROLES.ADMIN, assignment: false },
  delete: { minRole: ROLES.ADMIN, assignment: false },
  publish: { minRole: ROLES.ADMIN, assignment: false },
  attendees: { minRole: ROLES.FACILITATOR, assignment: true },
  attendees_manage: { minRole: ROLES.ADMIN, assignment: false },
  survey: { minRole: ROLES.ADMIN, assignment: false },
  // The one write a facilitator gets on the event row itself, and deliberately
  // narrow: the meeting link is made on the day, by whoever is running the
  // session, and waiting on an admin to paste it is how an online event starts
  // with nobody able to get in. Assignment-scoped like the attendee read — a
  // facilitator may set the link for their own event and no other. It is one
  // column behind its own endpoint, not the edit form, which stays admin-only.
  meeting_link: { minRole: ROLES.FACILITATOR, assignment: true },
  // Scoped exactly like meeting_link, and for the same reason: the photos of an
  // event are held by whoever was in the room, and routing them through an admin
  // is how an archive never gets posted. A facilitator may curate their own
  // event's and no other. It writes only EVENT_PHOTO — never the event row — so
  // it does not widen `edit`, which stays admin-only.
  photos: { minRole: ROLES.FACILITATOR, assignment: true },
};

export async function loadEventOr403(
  supabase: DbClient,
  eventId: number,
  user: EventGuardUser,
  capability: EventCapability,
): Promise<Event> {
  const event = await eventDao.findById(supabase, eventId);
  if (!event) {
    throw new EventServiceError(404, "Event not found");
  }

  const rule = CAPABILITY_RULE[capability];
  const allowed =
    hasMinRole(user.role, rule.minRole) &&
    (!rule.assignment || user.role !== ROLES.FACILITATOR || (await facilitatorDao.isAssigned(supabase, eventId, user.id)));

  if (!allowed) {
    throw new EventServiceError(403, "Forbidden");
  }

  return event;
}
