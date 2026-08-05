import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";

export interface RoomAccessFacts {
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
}

export type RoomAccessGate = "allowed" | "no_ticket" | "denied";

/**
 * The entry gate for an event room, decided from facts already fetched about
 * the caller.
 *
 * An assigned speaker clears the gate without holding a ticket. The bypass was
 * always meant to cover speakers, and only an assignment can reach it — an
 * unassigned speaker is turned away by the check above it.
 *
 * Pure and separate from `useRoomAccess` so the rule can be exercised directly:
 * the regression this pins is invisible to a test that reimplements it.
 */
export function canAccessRoom(role: UserRole | null, facts: RoomAccessFacts): RoomAccessGate {
  if (role === "speaker" && !facts.isSpeakerAssigned) return "denied";
  if (hasMinRole(role, "facilitator") || facts.hasTicket || facts.isSpeakerAssigned) return "allowed";
  return "no_ticket";
}
