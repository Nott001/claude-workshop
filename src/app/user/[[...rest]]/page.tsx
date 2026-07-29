"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useSession } from "@/modules/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Form, FormField, FormLabel } from "@/shared/components/ui/form";
import { Toast } from "@/shared/components/toast";

type ToastData = { title: string; description: string; type: "success" | "error" };

export default function UserSettingsPage() {
  const { user: currentUser } = useSession();
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const [toast, setToast] = useState<ToastData | null>(null);

  const [name, setName] = useState(currentUser?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
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
      setSavingName(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);

    const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
    if (authError) {
      setToast({ title: "Error", description: authError.message, type: "error" });
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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      setToast({ title: "Error", description: authError.message, type: "error" });
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setToast({ title: "Password updated", description: "Your password has been changed.", type: "success" });
    setSavingPassword(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/profile-image", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setToast({ title: "Upload failed", description: data.error ?? "Could not upload image.", type: "error" });
        return;
      }

      const data = await res.json();
      window.dispatchEvent(new CustomEvent("profile-photo-updated", { detail: { photoUrl: data.url } }));
      setToast({ title: "Photo updated", description: "Your profile photo has been changed.", type: "success" });
    } catch {
      setToast({ title: "Upload failed", description: "Could not upload image.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  const previewUrl = currentUser?.profile_image_url;

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
            <h2 className="text-sm font-bold text-fg">Profile Photo</h2>
            <p className="mt-1 text-xs text-muted-fg">JPEG or PNG, up to 50 MB.</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="material-symbols-rounded text-2xl text-muted-fg">person</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Uploading\u2026" : "Upload photo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-bold text-fg">Profile Name</h2>
            <Form onSubmit={handleSaveName} className="mt-4 flex gap-3">
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
              <Button type="submit" disabled={savingName}>
                {savingName ? "Saving\u2026" : "Save"}
              </Button>
            </Form>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-bold text-fg">Email</h2>
            <p className="mt-1 text-xs text-muted-fg">{currentUser?.email ?? ""}</p>
            {emailSent ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3">
                <span className="material-symbols-rounded mt-0.5 text-sm text-success">mark_email_unread</span>
                <p className="text-xs text-muted-fg">
                  Verification link sent to <span className="font-medium text-fg">{newEmail}</span>. Check your inbox.
                </p>
              </div>
            ) : (
              <Form onSubmit={handleEmailChange} className="mt-4 flex gap-3">
                <Input
                  type="email"
                  placeholder="new@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={savingEmail || !newEmail}>
                  {savingEmail ? "Sending\u2026" : "Change email"}
                </Button>
              </Form>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-bold text-fg">Password</h2>
            <Form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
              <FormField>
                <FormLabel htmlFor="current-password">Current password</FormLabel>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </FormField>
              <FormField>
                <FormLabel htmlFor="new-password">New password</FormLabel>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </FormField>
              <Button type="submit" disabled={savingPassword || !currentPassword || !newPassword}>
                {savingPassword ? "Updating\u2026" : "Update password"}
              </Button>
            </Form>
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
