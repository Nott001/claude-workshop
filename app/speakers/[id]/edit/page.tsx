"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditSpeakerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/speakers");
      if (!res.ok) {
        setError("Failed to load profile");
        setLoading(false);
        return;
      }
      const profiles = await res.json();
      const profile = profiles.find((p: { speaker_profile_id: number }) => p.speaker_profile_id === Number(profileId));
      if (!profile) {
        setError("Profile not found");
        setLoading(false);
        return;
      }
      setBio(profile.bio ?? "");
      setPhotoUrl(profile.photo_url ?? "");
      setDesignation(profile.designation ?? "");
      setLoading(false);
    }
    load();
  }, [profileId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch(`/api/speakers/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: bio || null,
        photo_url: photoUrl || null,
        designation: designation || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Failed to update profile");
      return;
    }

    router.push("/speakers");
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <button onClick={() => router.push("/speakers")}>&larr; Back to Speakers</button>
      <h1>Edit Speaker Profile</h1>

      {error && <p>{error}</p>}

      <form onSubmit={handleSubmit}>
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
        <button type="submit">Update</button>
      </form>
    </div>
  );
}
