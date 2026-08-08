import type { DbClient } from "@/shared/db/dao/types";
import type { Event, UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import * as eventDao from "@/modules/events/db/event.dao";
import * as facilitatorDao from "@/shared/db/dao/facilitator.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";

export type EventActor = { id: number };

export type EventGuardUser = { id: number; role: UserRole };

export type EventCapability = "edit" | "delete" | "publish" | "attendees";

// Courses keeps its own copy: the module boundary forbids courses → events, so
// the course-room guard (SPEC-05) cannot import this one.
export async function canManageEvent(supabase: DbClient, user: EventGuardUser, eventId: number): Promise<boolean> {
  if (hasMinRole(user.role, "admin")) return true;
  if (user.role === "facilitator") return facilitatorDao.isAssigned(supabase, eventId, user.id);
  if (user.role === "speaker") return speakerDao.isAssignedByUserId(supabase, user.id, eventId);
  return false;
}

// The capability matrix — the single source of truth. Every write action
// admits admin+ or an assigned facilitator; only delete is admin+, keeping an
// assigned facilitator from destroying an event they merely help run.
const CAPABILITY_RULE: Record<EventCapability, { minRole: UserRole; assignment: boolean }> = {
  edit: { minRole: "facilitator", assignment: true },
  delete: { minRole: "admin", assignment: false },
  publish: { minRole: "facilitator", assignment: true },
  attendees: { minRole: "facilitator", assignment: true },
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
    (!rule.assignment || user.role !== "facilitator" || (await facilitatorDao.isAssigned(supabase, eventId, user.id)));

  if (!allowed) {
    throw new EventServiceError(403, "Forbidden");
  }

  return event;
}
