"use client";

import { useEffect, useState } from "react";

interface SpeakerProfile {
  speaker_profile_id: number;
  user_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
  USERS: { full_name: string; email: string } | null;
}

export function useSpeakerProfiles() {
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

  return {
    profiles,
    loading,
    error,
    showCreate,
    setShowCreate,
    userId,
    setUserId,
    bio,
    setBio,
    photoUrl,
    setPhotoUrl,
    designation,
    setDesignation,
    handleCreate,
    handleDelete,
  };
}
