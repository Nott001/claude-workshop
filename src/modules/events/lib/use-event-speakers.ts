"use client";

import { useEffect, useState } from "react";

interface SpeakerProfile {
  speaker_profile_id: number;
  user_id: number;
  bio: string | null;
  designation: string | null;
}

interface Assignment {
  speaker_profile_id: number;
  SPEAKER_PROFILES: SpeakerProfile | null;
}

interface FullProfile extends SpeakerProfile {
  USERS: { full_name: string } | null;
}

export function useEventSpeakers(eventId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allProfiles, setAllProfiles] = useState<FullProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [assignRes, profilesRes] = await Promise.all([fetch(`/api/events/${eventId}/speakers`), fetch("/api/speakers")]);

      if (!assignRes.ok || !profilesRes.ok) {
        if (!cancelled) setError("Failed to load data");
        setLoading(false);
        return;
      }

      if (!cancelled) setAssignments(await assignRes.json());
      if (!cancelled) setAllProfiles(await profilesRes.json());
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfileId) return;

    const res = await fetch(`/api/events/${eventId}/speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker_profile_id: Number(selectedProfileId) }),
    });

    if (!res.ok) return;
    setSelectedProfileId("");
    setRefreshKey((k) => k + 1);
  }

  async function handleRemove(profileId: number) {
    if (!confirm("Remove this speaker from the event?")) return;
    const res = await fetch(`/api/events/${eventId}/speakers/${profileId}`, { method: "DELETE" });
    if (!res.ok) return;
    setRefreshKey((k) => k + 1);
  }

  const assignedIds = new Set(assignments.map((a) => a.speaker_profile_id));
  const availableProfiles = allProfiles.filter((p) => !assignedIds.has(p.speaker_profile_id));

  return {
    assignments,
    allProfiles,
    loading,
    error,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    assignedIds,
    handleAssign,
    handleRemove,
  };
}
