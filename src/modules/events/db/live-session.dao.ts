import type { DbClient } from "@/shared/db/dao/types";

export type HighlightStateRow = {
  highlighted_lesson_id: number | null;
  updated_by: number | null;
  updated_at: string | null;
  LESSON?: { id: number; description: string; content_type: string } | null;
};

export async function getHighlightState(supabase: DbClient, eventId: number): Promise<HighlightStateRow | null> {
  const { data, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .select("*, LESSON(id, description, content_type)")
    .eq("event_id", eventId)
    .single();
  if (error) {
    console.error("live-session.dao.getHighlightState failed:", error.message, error.code);
    return null;
  }
  return data;
}

export async function upsertHighlightState(
  supabase: DbClient,
  eventId: number,
  patch: { highlighted_lesson_id: number | null; updated_by: number; updated_at: string },
): Promise<HighlightStateRow | null> {
  const { data, error } = await supabase
    .from("LIVE_SESSION_STATE")
    .upsert({ event_id: eventId, ...patch }, { onConflict: "event_id" })
    .select()
    .single();
  if (error) {
    console.error("live-session.dao.upsertHighlightState failed:", error.message, error.code);
    return null;
  }
  return data;
}
