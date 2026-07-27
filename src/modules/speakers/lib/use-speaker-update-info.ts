"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ToastData = { title: string; description: string; type: "success" | "error" };

export function useSpeakerUpdateInfo() {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [role, setRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    fetch("/api/speakers/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRole(data.designation ?? "");
      })
      .catch(() => {});
  }, []);

  async function handleRoleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    try {
      const res = await fetch("/api/speakers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designation: role || null }),
      });
      if (res.ok) {
        setToast({ title: "Role Updated", description: "Your professional role has been saved.", type: "success" });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ title: "Update Failed", description: data.error ?? "Unable to update role.", type: "error" });
      }
    } catch {
      setToast({ title: "Update Failed", description: "Unable to update role.", type: "error" });
    }
    setSavingRole(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setToast({ title: "Passwords Mismatch", description: "New password and confirmation do not match.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ title: "Password Too Short", description: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setToast({ title: "Update Failed", description: error.message, type: "error" });
      } else {
        setToast({ title: "Password Updated", description: "Your password has been changed successfully.", type: "success" });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setToast({ title: "Update Failed", description: "Unable to update password.", type: "error" });
    }
    setSavingPassword(false);
  }

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    savingPassword,
    role,
    setRole,
    savingRole,
    toast,
    setToast,
    handleRoleUpdate,
    handlePasswordUpdate,
  };
}
