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
 * that endpoint is consulted as a fallback when the user has no app photo of
 * their own. An upload reaches this hook through the session, which the upload
 * caller refreshes from the URL the route persisted.
 */
export function useProfilePhoto(user: Pick<AuthUser, "profile_image_url"> | null): string | null {
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const signedIn = !!user;
  const profileImageUrl = user?.profile_image_url ?? null;

  // Keyed on the photo URL rather than on the user object, because the session
  // hands out a fresh object on every edit — renaming yourself would otherwise
  // re-request a photo that has not changed.
  useEffect(() => {
    if (!signedIn || profileImageUrl) return;

    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.photo_url) setCustomPhoto(data.photo_url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [signedIn, profileImageUrl]);

  // The app photo outranks the speaker one: a user who had neither, then
  // uploaded, holds a fetched speaker photo in state, and reading that first
  // would keep showing it over the picture they just chose.
  return profileImageUrl ?? customPhoto;
}
