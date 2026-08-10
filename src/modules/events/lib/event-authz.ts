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

export type EventCapability = "edit" | "delete" | "publish" | "attendees" | "survey";

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
const CAPABILITY_RULE: Record<EventCapability, { minRole: UserRole; assignment: boolean }> = {
  edit: { minRole: ROLES.ADMIN, assignment: false },
  delete: { minRole: ROLES.ADMIN, assignment: false },
  publish: { minRole: ROLES.ADMIN, assignment: false },
  attendees: { minRole: ROLES.FACILITATOR, assignment: true },
  survey: { minRole: ROLES.ADMIN, assignment: false },
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
