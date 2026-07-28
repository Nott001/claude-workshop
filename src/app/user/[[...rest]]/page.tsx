"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/modules/auth";
import { Toast } from "@/shared/components/toast";

type ToastData = { title: string; description: string; type: "success" | "error" };

export default function UserSettingsPage() {
  const { user: currentUser } = useSession();
  const fullName = currentUser?.full_name ?? "";
  const [toast, setToast] = useState<ToastData | null>(null);
  const [name, setName] = useState(fullName);
  const [saving, setSaving] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      if (res.ok) {
        setToast({ title: "Profile updated", description: "Your name has been saved.", type: "success" });
      } else {
        setToast({ title: "Error", description: "Failed to update profile.", type: "error" });
      }
    } catch {
      setToast({ title: "Error", description: "Failed to update profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[896px] px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand transition-colors hover:text-brand"
        >
          <span className="material-symbols-rounded text-[18px]">arrow_back</span>
          Back
        </Link>
        <h1 className="text-[32px] font-bold tracking-[-0.32px] text-fg leading-[40px]">Account Settings</h1>
        <p className="mt-1 text-base text-muted-fg leading-6">Manage your account, security, and profile.</p>

        <div className="mt-8 flex w-full flex-col gap-8">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-bold text-fg">Profile Name</h2>
            <form onSubmit={handleSaveName} className="mt-4 flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-bold text-fg">Password</h2>
            <p className="mt-2 text-xs text-muted-fg">Password updates are managed through your authentication provider.</p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast title={toast.title} description={toast.description} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
