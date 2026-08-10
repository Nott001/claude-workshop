"use client";

import { useEffect, useState } from "react";
import type { AuthUser } from "@/modules/auth/lib/types";

export function getInitials(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/);
  const first = parts[0]?.charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * The user object's profile_image_url is the app profile photo; the speaker
 * profile may carry a separate photo_url that only /api/auth/me knows about, so
 * that endpoint is consulted for a fallback. `profile-photo-updated` events let
 * the navbar pick up a photo the instant the user uploads one.
 */
export function useProfilePhoto(user: Pick<AuthUser, "profile_image_url"> | null): string | null {
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    if (!user.profile_image_url && !customPhoto) {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.photo_url) setCustomPhoto(data.photo_url);
        })
        .catch(() => {});
    }

    const handlePhotoUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.photoUrl) setCustomPhoto(detail.photoUrl);
    };
    window.addEventListener("profile-photo-updated", handlePhotoUpdate);
    return () => window.removeEventListener("profile-photo-updated", handlePhotoUpdate);
  }, [user, customPhoto]);

  return customPhoto ?? user?.profile_image_url ?? null;
}
