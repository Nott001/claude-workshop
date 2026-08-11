"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { ToastData } from "./use-account-settings";

export function useSpeakerProfile(notify: (toast: ToastData) => void) {
  const { user } = useSession();
  // A bio/designation is tied to the speaker row, so the exact role is required —
  // min-role would hand the section to facilitators and admins too.
  const isSpeaker = user?.role === ROLES.SPEAKER;

  const [speakerProfileId, setSpeakerProfileId] = useState<number | null | undefined>(undefined);
  const [designation, setDesignation] = useState("");
  const [bio, setBio] = useState("");
  const [savingSpeaker, setSavingSpeaker] = useState(false);

  useEffect(() => {
    if (!isSpeaker) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSpeakerProfileId(data.speaker_profile_id ?? null);
        setDesignation(data.designation ?? "");
        setBio(data.bio ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSpeaker]);

  async function saveSpeakerProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingSpeaker(true);

    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designation: designation.trim() || null, bio: bio.trim() || null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      notify({ title: "Error", description: data?.error ?? "Failed to save professional info.", type: "error" });
      setSavingSpeaker(false);
      return;
    }

    notify({ title: "Saved", description: "Professional info updated.", type: "success" });
    setSavingSpeaker(false);
  }

  return { isSpeaker, speakerProfileId, designation, setDesignation, bio, setBio, savingSpeaker, saveSpeakerProfile };
}
