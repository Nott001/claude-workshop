"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";

interface SpeakerProfile {
  speaker_profile_id: number;
  user_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
  USERS: { full_name: string; email: string } | null;
}

export default function SpeakersPage() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn } = useSession();
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [userId, setUserId] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [designation, setDesignation] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetch("/api/speakers");
      if (!res.ok) {
        if (!cancelled) setError("Failed to load speaker profiles");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) setProfiles(data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/speakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: Number(userId),
        bio: bio || null,
        photo_url: photoUrl || null,
        designation: designation || null,
      }),
    });
    if (!res.ok) return;
    setShowCreate(false);
    setUserId("");
    setBio("");
    setPhotoUrl("");
    setDesignation("");
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this speaker profile?")) return;
    const res = await fetch(`/api/speakers/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRefreshKey((k) => k + 1);
  }

  if (loading) return <div>Loading speaker profiles...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <div>
        <h1>Speaker Profiles</h1>
        {isLoaded && isSignedIn && <button onClick={() => setShowCreate(true)}>Create Speaker Profile</button>}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate}>
          <div>
            <label>User ID</label>
            <input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
          <div>
            <label>Designation</label>
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div>
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <label>Photo URL</label>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <button type="submit">Save</button>
          <button type="button" onClick={() => setShowCreate(false)}>
            Cancel
          </button>
        </form>
      )}

      {profiles.length === 0 ? (
        <p>No speaker profiles yet.</p>
      ) : (
        <ul>
          {profiles.map((profile) => (
            <li key={profile.speaker_profile_id}>
              <div>
                <strong>{profile.USERS?.full_name ?? `User #${profile.user_id}`}</strong>
                {profile.designation && <span> - {profile.designation}</span>}
              </div>
              {profile.bio && <p>{profile.bio}</p>}
              <div>
                <button onClick={() => router.push(`/speakers/${profile.speaker_profile_id}/edit`)}>Edit</button>
                <button onClick={() => handleDelete(profile.speaker_profile_id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
