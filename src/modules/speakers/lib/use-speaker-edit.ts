"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useSpeakerEdit(profileId: string) {
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoUrl("");
    }
  }

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
        return;
      }
      setUploading(false);
    }

    router.push("/speakers");
  }

  return {
    bio,
    setBio,
    photoUrl,
    setPhotoUrl,
    photoFile,
    setPhotoFile,
    designation,
    setDesignation,
    error,
    loading,
    uploading,
    handleFileChange,
    handleSubmit,
  };
}
