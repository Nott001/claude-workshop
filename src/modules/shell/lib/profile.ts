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
 * that endpoint is consulted for a fallback. Uploads update the session user
 * directly, so reading profile_image_url here picks them up the instant they
 * land — and it wins over the speaker fallback so a new app photo is never
 * hidden by a stale speaker one.
 */
export function useProfilePhoto(user: Pick<AuthUser, "profile_image_url"> | null): string | null {
  const [speakerPhoto, setSpeakerPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.profile_image_url || speakerPhoto) return;

    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.photo_url) setSpeakerPhoto(data.photo_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, speakerPhoto]);

  return user?.profile_image_url ?? speakerPhoto ?? null;
}
