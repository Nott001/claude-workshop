"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Footer } from "@/components/footer";

export default function EditSpeakerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        photo_url: photoFile ? undefined : photoUrl || null,
        designation: designation || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Failed to update profile");
      return;
    }

    if (photoFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", photoFile);

      const uploadRes = await fetch("/api/upload/profile-image", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        setError("Profile updated but photo upload failed.");
        setUploading(false);
        router.push("/speakers");
        return;
      }
      setUploading(false);
    }

    router.push("/speakers");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoUrl("");
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
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
            <label>Photo</label>
            {photoUrl && !photoFile && (
              <div>
                <img src={photoUrl} alt="Current photo" style={{ maxWidth: "150px" }} />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} />
            {photoFile && <p>Selected: {photoFile.name}</p>}
            <input
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPhotoFile(null);
              }}
              placeholder="Or paste image URL"
            />
          </div>
          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Update"}
          </button>
        </form>
      </div>
      <Footer role="speaker" />
    </>
  );
}
