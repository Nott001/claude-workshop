"use client";

import { useState } from "react";

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";

interface ProfileNameFormProps {
  initialName: string;
  onToast: (toast: { title: string; description: string; type: "success" | "error" }) => void;
}

export function ProfileNameForm({ initialName, onToast }: ProfileNameFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (res.ok) {
        onToast({ title: "Name Updated", description: "Your name has been updated.", type: "success" });
      } else {
        const data = await res.json().catch(() => ({}));
        onToast({ title: "Update Failed", description: data.error ?? "Unable to update name.", type: "error" });
      }
    } catch {
      onToast({ title: "Update Failed", description: "Unable to update name.", type: "error" });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div className="flex items-center gap-4">
        <span className="material-symbols-rounded text-[28px] text-brand">person</span>
        <h2 className="text-[24px] font-semibold text-fg leading-8">Profile Name</h2>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Full Name</label>
        <input
          type="text"
          required
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving || !fullName}
          className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
