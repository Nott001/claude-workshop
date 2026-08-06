import type { DbClient } from "./types";
import type { User } from "@/shared/types";

export interface FacilitatorCandidate {
  id: number;
  full_name: string;
  email: string;
}

export interface EventFacilitatorAssignment {
  user_id: number;
  assigned_by: number | null;
  USER: Pick<User, "full_name" | "email"> | null;
}

export async function listCandidates(supabase: DbClient): Promise<FacilitatorCandidate[]> {
  const { data } = await supabase
    .from("USER")
    .select("id, full_name, email")
    .eq("role", "facilitator")
    .order("full_name", { ascending: true });
  return data ?? [];
}

export async function isAssigned(supabase: DbClient, eventId: number, userId: number): Promise<boolean> {
  const { data } = await supabase
    .from("EVENT_FACILITATOR")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function listEventAssignments(supabase: DbClient, eventId: number): Promise<EventFacilitatorAssignment[]> {
  const { data } = await supabase
    .from("EVENT_FACILITATOR")
    .select("user_id, assigned_by, USER(full_name, email)")
    .eq("event_id", eventId);
  // PostgREST returns one USER object per row (user_id is the to-one FK), but
  // supabase-js types the embed as an array because EVENT_FACILITATOR also has
  // assigned_by pointing at USER. The runtime shape follows the FK, not the type.
  return (data ?? []) as unknown as EventFacilitatorAssignment[];
}

/**
 * Make the event's facilitator set exactly `userIds`, recording who assigned
 * them. Ids that do not belong to a facilitator-role user are dropped, so a
 * caller cannot grant moderator access to an attendee by id.
 */
export async function replaceEventAssignments(
  supabase: DbClient,
  eventId: number,
  userIds: number[],
  assignedBy: number,
): Promise<boolean> {
  const { data: valid } = await supabase.from("USER").select("id").in("id", userIds).eq("role", "facilitator");
  const validIds = (valid ?? []).map((u: { id: number }) => u.id);

  const { error: deleteError } = await supabase.from("EVENT_FACILITATOR").delete().eq("event_id", eventId);
  if (deleteError) return false;

  if (validIds.length === 0) return true;

  const { error: insertError } = await supabase
    .from("EVENT_FACILITATOR")
    .insert(validIds.map((user_id) => ({ event_id: eventId, user_id, assigned_by: assignedBy })));
  return !insertError;
}
