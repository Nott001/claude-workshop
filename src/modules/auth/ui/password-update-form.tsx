"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";

interface PasswordUpdateFormProps {
  onToast: (toast: { title: string; description: string; type: "success" | "error" }) => void;
}

export function PasswordUpdateForm({ onToast }: PasswordUpdateFormProps) {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      onToast({ title: "Passwords Mismatch", description: "New password and confirmation do not match.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      onToast({ title: "Password Too Short", description: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        onToast({ title: "Update Failed", description: error.message, type: "error" });
      } else {
        onToast({ title: "Password Updated", description: "Your password has been changed successfully.", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      onToast({ title: "Update Failed", description: "Unable to update password.", type: "error" });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div className="flex items-center gap-4">
        <span className="material-symbols-rounded text-[28px] text-brand">lock</span>
        <h2 className="text-[24px] font-semibold text-fg leading-8">Update Password</h2>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className={labelClass}>New Password</label>
          <input
            type="password"
            required
            placeholder="Min. 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Confirm New Password</label>
          <input
            type="password"
            required
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex gap-3 rounded-xl bg-muted p-4">
          <span className="material-symbols-rounded mt-0.5 text-[14px] text-muted-fg">info</span>
          <p className="text-[12px] leading-[18px] text-muted-fg">
            Security Tip: Use a combination of uppercase letters, numbers, and symbols to create a robust password.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="submit"
          disabled={saving || !newPassword || !confirmPassword}
          className="rounded-xl bg-brand px-8 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50"
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </form>
  );
}
