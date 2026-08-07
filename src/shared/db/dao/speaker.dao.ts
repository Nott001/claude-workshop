import type { DbClient } from "./types";
import type { SpeakerProfile, User } from "@/shared/types";

/** A SPEAKER_PROFILE row with the USER embed `list` selects. Note both are singular. */
export interface SpeakerProfileWithUser extends SpeakerProfile {
  USER: Pick<User, "full_name" | "email"> | null;
}

/** An EVENT_SPEAKER row as `listEventAssignments` selects it. */
export interface EventSpeakerAssignment {
  event_id: number;
  speaker_profile_id: number;
  SPEAKER_PROFILE: (SpeakerProfile & { USER: Pick<User, "full_name"> | null }) | null;
}

export async function findById(supabase: DbClient, id: number): Promise<SpeakerProfile | null> {
  const { data } = await supabase.from("SPEAKER_PROFILE").select("*").eq("id", id).single();
  return data;
}

export async function findByUserId(supabase: DbClient, userId: number): Promise<SpeakerProfile | null> {
  const { data } = await supabase.from("SPEAKER_PROFILE").select("*").eq("user_id", userId).single();
  return data;
}

export async function list(supabase: DbClient): Promise<SpeakerProfileWithUser[]> {
  const { data } = await supabase.from("SPEAKER_PROFILE").select("*, USER(full_name, email)").order("id", { ascending: false });
  return data ?? [];
}

/**
 * Speaker profiles whose owner still holds the speaker role. A profile whose
 * user was re-roled is not assignable, so the create/edit form must not offer it.
 */
export async function listCandidates(supabase: DbClient): Promise<SpeakerProfileWithUser[]> {
  const { data } = await supabase
    .from("SPEAKER_PROFILE")
    .select("*, USER(full_name, email)")
    .eq("USER.role", "speaker")
    .order("id", { ascending: false });
  return data ?? [];
}

export async function create(
  supabase: DbClient,
  data: {
    user_id: number;
    bio?: string | null;
    photo_url?: string | null;
    designation?: string | null;
  },
): Promise<SpeakerProfile | null> {
  const { data: profile, error } = await supabase
    .from("SPEAKER_PROFILE")
    .insert({
      user_id: data.user_id,
      bio: data.bio ?? null,
      designation: data.designation ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("speaker.dao.create failed:", error.message, error.code);
    return null;
  }
  return profile;
}

export async function update(supabase: DbClient, id: number, data: Record<string, unknown>): Promise<SpeakerProfile | null> {
  const { data: profile, error } = await supabase.from("SPEAKER_PROFILE").update(data).eq("id", id).select("*").single();

  if (error) {
    console.error("speaker.dao.update failed:", error.message, error.code);
    return null;
  }
  return profile;
}

export async function remove(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("SPEAKER_PROFILE").delete().eq("id", id);
  return !error;
}

export async function listEventAssignments(supabase: DbClient, eventId: number): Promise<EventSpeakerAssignment[]> {
  // The nested USER embed gives the assignment roster names, which is what the
  // builder's speaker select and the host wiring display.
  const { data } = await supabase
    .from("EVENT_SPEAKER")
    .select("*, SPEAKER_PROFILE(*, USER(full_name))")
    .eq("event_id", eventId);
  return data ?? [];
}

export async function assignToEvent(supabase: DbClient, eventId: number, speakerProfileId: number): Promise<boolean> {
  const { error } = await supabase.from("EVENT_SPEAKER").insert({ event_id: eventId, speaker_profile_id: speakerProfileId });
  return !error;
}

/**
 * Make the event's speaker set exactly `speakerProfileIds`. Ids that do not
 * belong to a speaker-role profile are dropped, so a caller cannot grant a
 * non-speaker an EVENT_SPEAKER row by id.
 */
export async function replaceEventAssignments(
  supabase: DbClient,
  eventId: number,
  speakerProfileIds: number[],
): Promise<boolean> {
  // Selecting the embed makes the USER.role filter legal; without it in the
  // select list PostgREST answers PGRST108 and every speaker is silently dropped.
  const { data: valid } = await supabase
    .from("SPEAKER_PROFILE")
    .select("id, USER(role)")
    .in("id", speakerProfileIds)
    .eq("USER.role", "speaker");
  const validIds = (valid ?? []).map((s: { id: number }) => s.id);

  const { error: deleteError } = await supabase.from("EVENT_SPEAKER").delete().eq("event_id", eventId);
  if (deleteError) return false;

  if (validIds.length === 0) return true;

  const { error: insertError } = await supabase
    .from("EVENT_SPEAKER")
    .insert(validIds.map((speaker_profile_id) => ({ event_id: eventId, speaker_profile_id })));
  return !insertError;
}

export async function unassignFromEvent(supabase: DbClient, eventId: number, speakerProfileId: number): Promise<boolean> {
  const { error } = await supabase
    .from("EVENT_SPEAKER")
    .delete()
    .eq("event_id", eventId)
    .eq("speaker_profile_id", speakerProfileId);
  return !error;
}

export async function getSpeakerEventIds(supabase: DbClient, speakerProfileId: number): Promise<number[]> {
  const { data } = await supabase.from("EVENT_SPEAKER").select("event_id").eq("speaker_profile_id", speakerProfileId);
  return (data ?? []).map((a: { event_id: number }) => a.event_id);
}

/**
 * Whether the user's speaker profile is assigned to the event. The profile is
 * resolved first, then the assignment is checked by profile id: filtering an
 * embed that is not in the select list makes PostgREST answer PGRST108, so the
 * join must happen in two plain queries — the same shape the speaker route uses.
 */
export async function isAssignedByUserId(supabase: DbClient, userId: number, eventId: number): Promise<boolean> {
  const profile = await findByUserId(supabase, userId);
  if (!profile) return false;
  return checkSpeakerAssignment(supabase, profile.id, eventId);
}

export async function checkSpeakerAssignment(supabase: DbClient, speakerProfileId: number, eventId: number): Promise<boolean> {
  const { data } = await supabase
    .from("EVENT_SPEAKER")
    .select("event_id")
    .eq("speaker_profile_id", speakerProfileId)
    .eq("event_id", eventId)
    .single();
  return !!data;
}
