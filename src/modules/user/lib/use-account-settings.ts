"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import { getBrowserClient } from "@/shared/db/browser-client";
import { resizeImage } from "@/shared/integrations/storage/resize-image";

export type ToastData = { title: string; description: string; type: "success" | "error" };

export function useAccountSettings() {
  const { user: currentUser } = useSession();
  const supabase = getBrowserClient();

  const [toast, setToast] = useState<ToastData | null>(null);
  // Shared with the speaker profile hook so every section toasts in one place.
  const notify = useCallback((data: ToastData) => setToast(data), []);

  const [name, setName] = useState(currentUser?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploading, setUploading] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      if (res.ok) {
        notify({ title: "Profile updated", description: "Your name has been saved.", type: "success" });
      } else {
        notify({ title: "Error", description: "Failed to update profile.", type: "error" });
      }
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
      const formData = new FormData();
      formData.append("file", await resizeImage(file));

      const res = await fetch("/api/upload/profile-image", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        notify({ title: "Upload failed", description: data.error ?? "Could not upload image.", type: "error" });
        return;
      }

      const data = await res.json();
      window.dispatchEvent(new CustomEvent("profile-photo-updated", { detail: { photoUrl: data.url } }));
      notify({ title: "Photo updated", description: "Your profile photo has been changed.", type: "success" });
    } catch {
      notify({ title: "Upload failed", description: "Could not upload image.", type: "error" });
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
