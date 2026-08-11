"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import type { AuthUser } from "@/modules/auth/lib/types";
import { getBrowserClient } from "@/shared/db/browser-client";
import { postUpload } from "@/shared/integrations/storage/upload-client";

export type ToastData = { title: string; description: string; type: "success" | "error" };

export function useAccountSettings() {
  const { user: currentUser, updateUser } = useSession();
  const supabase = getBrowserClient();

  const [toast, setToast] = useState<ToastData | null>(null);
  // Shared with the speaker profile hook so every section toasts in one place.
  const notify = useCallback((data: ToastData) => setToast(data), []);

  // The page renders before the session resolves, so the field cannot simply be
  // seeded once at mount — it would stay empty and Save would then write that
  // blank over a real name. Adopt the session's name whenever it actually
  // changes, which leaves an edit in progress untouched on unrelated renders.
  const sessionName = currentUser?.full_name ?? "";
  const [name, setName] = useState(sessionName);
  const [lastSessionName, setLastSessionName] = useState(sessionName);
  const [savingName, setSavingName] = useState(false);

  if (sessionName !== lastSessionName) {
    setLastSessionName(sessionName);
    setName(sessionName);
  }

  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploading, setUploading] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const fullName = name.trim();
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) throw new Error("PATCH /api/auth/me failed");

      // The route echoes the stored row, so the session is refreshed from what
      // was actually written rather than from what we hoped to write. This is
      // what repaints the navbar, which renders the name off the session.
      const saved: Partial<AuthUser> = await res.json();
      const persisted = saved.full_name ?? fullName;
      updateUser({ full_name: persisted });
      setName(persisted);

      notify({ title: "Profile updated", description: "Your name has been saved.", type: "success" });
    } catch {
      notify({ title: "Error", description: "Failed to update profile.", type: "error" });
    } finally {
      setSavingName(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);

    const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
    if (authError) {
      notify({ title: "Error", description: authError.message, type: "error" });
      setSavingEmail(false);
      return;
    }

    await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });

    setEmailSent(true);
    setSavingEmail(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      notify({ title: "Error", description: authError.message, type: "error" });
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    notify({ title: "Password updated", description: "Your password has been changed.", type: "success" });
    setSavingPassword(false);
  }

  async function changeProfilePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await postUpload("profile_images", "/api/upload/profile-image", file);

      if (!result.ok) {
        notify({ title: "Upload failed", description: result.error, type: "error" });
        return;
      }

      // The upload route has already written this URL to the user row, so the
      // session is only being caught up to it — that is what repaints both the
      // preview beside this button and the navbar avatar.
      updateUser({ profile_image_url: result.url });
      notify({ title: "Photo updated", description: "Your profile photo has been changed.", type: "success" });
    } finally {
      setUploading(false);
    }
  }

  return {
    toast,
    dismissToast: () => setToast(null),
    notify,
    currentUser,
    name,
    setName,
    savingName,
    saveName,
    newEmail,
    setNewEmail,
    emailSent,
    savingEmail,
    changeEmail,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    savingPassword,
    changePassword,
    uploading,
    changeProfilePhoto,
  };
}
