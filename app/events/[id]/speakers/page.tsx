"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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

export default function EventSpeakersPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allProfiles, setAllProfiles] = useState<FullProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");

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
    return () => { cancelled = true; };
  }, [eventId]);

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
    await loadAll();
  }

  async function handleRemove(profileId: number) {
    if (!confirm("Remove this speaker from the event?")) return;
    const res = await fetch(`/api/events/${eventId}/speakers/${profileId}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadAll();
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  const assignedIds = new Set(assignments.map((a) => a.speaker_profile_id));
  const availableProfiles = allProfiles.filter((p) => !assignedIds.has(p.speaker_profile_id));

  return (
    <div>
      <button onClick={() => router.push(`/events/${eventId}`)}>&larr; Back to Event</button>
      <h1>Manage Speakers</h1>

      <h2>Assigned Speakers</h2>
      {assignments.length === 0 ? (
        <p>No speakers assigned yet.</p>
      ) : (
        <ul>
          {assignments.map((a) => (
            <li key={a.speaker_profile_id}>
              {a.SPEAKER_PROFILES ? (
                <>
                  <span>Profile #{a.speaker_profile_id}</span>
                  {a.SPEAKER_PROFILES.designation && <span> - {a.SPEAKER_PROFILES.designation}</span>}
                  {a.SPEAKER_PROFILES.bio && <p>{a.SPEAKER_PROFILES.bio}</p>}
                </>
              ) : (
                <span>Profile #{a.speaker_profile_id}</span>
              )}
              <button onClick={() => handleRemove(a.speaker_profile_id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h2>Assign Speaker</h2>
      {availableProfiles.length === 0 ? (
        <p>No available speakers to assign.</p>
      ) : (
        <form onSubmit={handleAssign}>
          <div>
            <label>Speaker Profile</label>
            <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} required>
              <option value="">Select a speaker...</option>
              {availableProfiles.map((p) => (
                <option key={p.speaker_profile_id} value={p.speaker_profile_id}>
                  {p.USERS?.full_name ?? `User #${p.user_id}`}
                  {p.designation ? ` (${p.designation})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Assign</button>
        </form>
      )}
    </div>
  );
}
