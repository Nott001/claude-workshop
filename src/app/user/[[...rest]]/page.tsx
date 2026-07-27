"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession } from "@/modules/auth";
import { createBrowserClient } from "@supabase/ssr";
import { Toast } from "@/components/toast";

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";
const readOnlyInputClass = "w-full rounded-xl border border-border bg-muted px-[17px] py-[13px] text-base text-muted-fg";

type ToastData = { title: string; description: string; type: "success" | "error" };

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  designation: string | null;
  photo_url: string | null;
  full_name: string;
  email: string;
}

export default function UserSettingsPage() {
  const { user: currentUser, isSignedIn, signOut } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [speakerProfile, setSpeakerProfile] = useState<SpeakerProfile | null>(null);
  const [speakerLoading, setSpeakerLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const isSpeaker = userRole === "speaker";

  useEffect(() => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUserRole(data.role);
          setFullName(data.full_name ?? "");
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSpeaker) {
      setSpeakerLoading(false);
      return;
    }
    fetch("/api/speakers/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSpeakerProfile(data);
        setSpeakerLoading(false);
      })
      .catch(() => setSpeakerLoading(false));
  }, [isSpeaker]);

  async function handleNameUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (res.ok) {
        setToast({ title: "Name Updated", description: "Your name has been updated.", type: "success" });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ title: "Update Failed", description: data.error ?? "Unable to update name.", type: "error" });
      }
    } catch {
      setToast({ title: "Update Failed", description: "Unable to update name.", type: "error" });
    }
    setSavingName(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
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
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setToast({ title: "Update Failed", description: "Unable to update password.", type: "error" });
    }
    setSavingPassword(false);
  }

  async function handleSpeakerSave() {
    if (!speakerProfile) return;
    setSavingSpeaker(true);
    const res = await fetch("/api/speakers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designation: speakerProfile.designation, bio: speakerProfile.bio }),
    });
    if (res.ok) {
      setToast({ title: "Profile Updated", description: "Your speaker profile has been saved.", type: "success" });
    } else {
      setToast({ title: "Error", description: "Failed to save speaker profile.", type: "error" });
    }
    setSavingSpeaker(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/profile-image", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setSpeakerProfile((prev) => (prev ? { ...prev, photo_url: data.url } : prev));
      window.dispatchEvent(new CustomEvent("profile-photo-updated", { detail: { photoUrl: data.url } }));
      setToast({ title: "Photo Updated", description: "Your profile photo has been updated.", type: "success" });
    } else {
      URL.revokeObjectURL(previewUrl);
      setPhotoPreview(null);
      const data = await res.json();
      setToast({ title: "Upload Failed", description: data.error ?? "Could not upload photo.", type: "error" });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const speakerInitials = (speakerProfile?.full_name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
          {isSpeaker && !speakerLoading && speakerProfile && (
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-rounded text-[28px] text-brand">badge</span>
                  <h2 className="text-[24px] font-semibold text-fg leading-8">Speaker Profile</h2>
                </div>
                <button
                  onClick={handleSpeakerSave}
                  disabled={savingSpeaker}
                  className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSpeaker ? "Saving..." : "Save Profile"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center rounded-xl bg-muted p-6">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="relative size-32 rounded-full border-4 border-white shadow-[0_10px_15px_-3px_rgba(0,0,0,.1),0_4px_6px_-4px_rgba(0,0,0,.1)] transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {(photoPreview ?? speakerProfile.photo_url) ? (
                      <img
                        src={photoPreview ?? speakerProfile.photo_url!}
                        alt=""
                        className="size-full rounded-full object-cover"
                        onError={() => {
                          setPhotoPreview(null);
                          setSpeakerProfile((prev) => (prev ? { ...prev, photo_url: null } : prev));
                        }}
                      />
                    ) : (
                      <div className="grid size-full place-items-center rounded-full bg-brand/20 text-3xl font-bold text-brand">
                        {speakerInitials}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors hover:bg-black/20">
                      <span className="material-symbols-rounded text-2xl text-white opacity-0 transition-opacity hover:opacity-100">
                        camera_alt
                      </span>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <span className="mt-4 text-sm font-medium tracking-wider text-muted-foreground">
                    {uploading ? "Uploading..." : "Change Photo"}
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelClass}>Professional Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Keynote Speaker"
                      value={speakerProfile.designation ?? ""}
                      onChange={(e) => setSpeakerProfile((prev) => (prev ? { ...prev, designation: e.target.value } : prev))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>Professional Bio</label>
                <textarea
                  rows={4}
                  placeholder="Tell attendees about yourself..."
                  value={speakerProfile.bio ?? ""}
                  onChange={(e) => setSpeakerProfile((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
                  className={`${inputClass} resize-none whitespace-pre-wrap`}
                />
              </div>
            </div>
          )}

          <form onSubmit={handleNameUpdate} className={cardClass}>
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
                disabled={savingName || !fullName}
                className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingName ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordUpdate} className={cardClass}>
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
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="rounded-xl bg-brand px-8 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
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
