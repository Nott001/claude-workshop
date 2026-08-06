"use client";

import { useEffect, useState } from "react";
import type { EventSpeakerAssignment } from "@/shared/db/dao/speaker.dao";

/** The roster shape the builder's `eventSpeakers` prop expects. */
export interface AssignedSpeaker {
  speaker_profile_id: number;
  full_name: string;
}

export function useAssignedSpeakers(eventId: string) {
  const [speakers, setSpeakers] = useState<AssignedSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/events/${eventId}/speakers`);
      if (cancelled) return;
      if (!res.ok) {
        setError("Failed to load speakers");
        setLoading(false);
        return;
      }
      const rows = (await res.json()) as EventSpeakerAssignment[];
      if (cancelled) return;

      // A speaker whose user row is gone cannot be put on a module, so drop it.
      setSpeakers(
        rows
          .map((row) => ({
            speaker_profile_id: row.speaker_profile_id,
            full_name: row.SPEAKER_PROFILE?.USER?.full_name ?? null,
          }))
          .filter((speaker): speaker is AssignedSpeaker => speaker.full_name !== null),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { speakers, loading, error };
}
