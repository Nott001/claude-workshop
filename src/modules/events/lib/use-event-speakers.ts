"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// The API serves these DAO rows verbatim, so the shapes come from the DAO
// rather than a hand-written copy. The copy that used to live here had drifted:
// it called the SPEAKER_PROFILE key `speaker_profile_id` (it is `id`) and the
// embed `USERS` (it is `USER`), which is why every name rendered as
// "Speaker #undefined" and no assigned speaker was ever filtered out.
import type { SpeakerProfileWithUser, EventSpeakerAssignment } from "@/shared/db/dao/speaker.dao";

const PAGE_SIZE = 50;

export function useEventSpeakers(eventId: string) {
  const [assignments, setAssignments] = useState<EventSpeakerAssignment[]>([]);
  const [allProfiles, setAllProfiles] = useState<SpeakerProfileWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesLoadingMore, setProfilesLoadingMore] = useState(false);
  const [profilesHasMore, setProfilesHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const profilePageRef = useRef(1);

  const loadProfiles = useCallback(async (page: number, append: boolean) => {
    try {
      const res = await fetch(`/api/speakers?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) return false;
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []) as SpeakerProfileWithUser[];
      setAllProfiles((prev) => (append ? [...prev, ...rows] : rows));
      setProfilesHasMore((data.total ?? 0) > page * PAGE_SIZE);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [assignRes, profilesRes] = await Promise.all([fetch(`/api/events/${eventId}/speakers`), fetch("/api/speakers")]);
      // `loading` too: this effect re-runs on every assign and remove, so a
      // superseded run clearing it renders "no speakers" over live data.
      if (cancelled) return;

      if (!assignRes.ok || !profilesRes.ok) {
        setError("Failed to load data");
        setLoading(false);
        return;
      }

      const [assignmentRows, profileRows] = await Promise.all([assignRes.json(), profilesRes.json()]);
      if (cancelled) return;

      profilePageRef.current = 1;
      setAssignments(assignmentRows);
      setAllProfiles(Array.isArray(profileRows.data) ? profileRows.data : []);
      setProfilesHasMore((profileRows.total ?? 0) > PAGE_SIZE);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshKey]);

  const loadMoreProfiles = useCallback(async () => {
    if (profilesLoadingMore) return;
    setProfilesLoadingMore(true);
    const next = profilePageRef.current + 1;
    profilePageRef.current = next;
    await loadProfiles(next, true);
    setProfilesLoadingMore(false);
  }, [loadProfiles, profilesLoadingMore]);

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
  const availableProfiles = allProfiles.filter((p) => !assignedIds.has(p.id));

  return {
    assignments,
    allProfiles,
    loading,
    profilesLoadingMore,
    profilesHasMore,
    loadMoreProfiles,
    error,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    assignedIds,
    handleAssign,
    handleRemove,
  };
}
