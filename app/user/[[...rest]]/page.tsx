"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useReverification, useClerk } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Toast } from "@/components/toast";

const cardClass = "rounded-xl border border-[#bdc8d1] bg-white p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-[#3e4850] tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-[#bdc8d1] bg-white px-[17px] py-[15px] text-base text-[#0f172a] outline-none transition-colors placeholder:text-[#6b7280] focus:border-[#29b6f6] focus:ring-1 focus:ring-[#29b6f6]";
const readOnlyInputClass =
  "w-full rounded-xl border border-[#bdc8d1] bg-[#edeef0] px-[17px] py-[13px] text-base text-[#5f5e5e]";

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
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [speakerProfile, setSpeakerProfile] = useState<SpeakerProfile | null>(null);
  const [speakerLoading, setSpeakerLoading] = useState(true);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const currentEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const isSpeaker = userRole === "speaker";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role as string);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSpeaker) {
      setSpeakerLoading(false);
      return;
    }
    fetch("/api/speakers/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSpeakerProfile(data);
        }
        setSpeakerLoading(false);
      })
      .catch(() => setSpeakerLoading(false));
  }, [isSpeaker]);

  const updateName = useReverification(({ firstName, lastName }: { firstName: string; lastName: string }) =>
    user!.update({ firstName, lastName }),
  );

  const addEmail = useReverification((email: string) =>
    user!.createEmailAddress({ email }).then(async (ea) => {
      await ea.prepareVerification({ strategy: "email_code" });
      return ea;
    }),
  );

  const updatePassword = useReverification(
    ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      user!.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: false }),
  );

  async function handleNameUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName && !lastName) return;
    setSavingName(true);
    try {
      await updateName({ firstName: firstName || user!.firstName || "", lastName: lastName || user!.lastName || "" });
      setToast({ title: "Name Updated", description: "Your name has been updated.", type: "success" });
    } catch (err: any) {
      if (isReverificationCancelledError(err)) {
        setToast({ title: "Verification Cancelled", description: "You cancelled the verification step.", type: "error" });
      } else {
        setToast({
          title: "Update Failed",
          description: err?.errors?.[0]?.message ?? err?.message ?? "Unable to update name.",
          type: "error",
        });
      }
    }
    setSavingName(false);
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || newEmail === currentEmail || !user) return;
    setSavingEmail(true);
    try {
      await addEmail(newEmail);
      setToast({
        title: "Verification Sent",
        description: "Check your new email inbox for a verification code.",
        type: "success",
      });
      setNewEmail("");
    } catch (err: any) {
      if (isReverificationCancelledError(err)) {
        setToast({ title: "Verification Cancelled", description: "You cancelled the verification step.", type: "error" });
      } else {
        setToast({
          title: "Update Failed",
          description: err?.errors?.[0]?.message ?? err?.message ?? "Unable to update email.",
          type: "error",
        });
      }
    }
    setSavingEmail(false);
  }

  async function handleForgotPassword() {
    await signOut();
    router.push("/sign-in");
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
      await updatePassword({ currentPassword, newPassword });
      setToast({ title: "Password Updated", description: "Your password has been changed successfully.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (isReverificationCancelledError(err)) {
        setToast({ title: "Verification Cancelled", description: "You cancelled the verification step.", type: "error" });
      } else {
        setToast({
          title: "Update Failed",
          description: err?.errors?.[0]?.message ?? err?.message ?? "Unable to update password.",
          type: "error",
        });
      }
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
    <div className="flex flex-1 flex-col bg-[#fbf9f8]">
      <div className="mx-auto w-full max-w-[896px] px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#00658d] transition-colors hover:text-[#004460]"
        >
          <span className="material-symbols-rounded text-[18px]">arrow_back</span>
          Back
        </Link>
        <h1 className="text-[32px] font-bold tracking-[-0.32px] text-[#0f172a] leading-[40px]">Account Settings</h1>
        <p className="mt-1 text-base text-[#5f5e5e] leading-6">Manage your account, security, and profile.</p>

        <div className="mt-8 flex w-full flex-col gap-8">
          {isSpeaker && !speakerLoading && speakerProfile && (
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-rounded text-[28px] text-[#29b6f6]">badge</span>
                  <h2 className="text-[24px] font-semibold text-[#0f172a] leading-8">Speaker Profile</h2>
                </div>
                <button
                  onClick={handleSpeakerSave}
                  disabled={savingSpeaker}
                  className="rounded-xl bg-[#29b6f6] px-6 py-3 text-[14px] font-semibold text-[#004460] tracking-[0.7px] transition-colors hover:bg-[#2196f3] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSpeaker ? "Saving..." : "Save Profile"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center rounded-xl bg-[#efeded] p-6">
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
                      <div className="grid size-full place-items-center rounded-full bg-[#c2e8ff] text-3xl font-bold text-[#29b6f6]">
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
              <span className="material-symbols-rounded text-[28px] text-[#29b6f6]">person</span>
              <h2 className="text-[24px] font-semibold text-[#0f172a] leading-8">Profile Name</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>First Name</label>
                <input
                  type="text"
                  required
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  required
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingName || (!firstName && !lastName)}
                className="rounded-xl bg-[#29b6f6] px-6 py-3 text-[14px] font-semibold text-[#004460] tracking-[0.7px] transition-colors hover:bg-[#2196f3] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingName ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <form onSubmit={handleEmailUpdate} className={cardClass}>
            <div className="flex items-center gap-4">
              <span className="material-symbols-rounded text-[28px] text-[#29b6f6]">mail</span>
              <h2 className="text-[24px] font-semibold text-[#0f172a] leading-8">Update Email Address</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Current Email Address</label>
                <div className={readOnlyInputClass}>{currentEmail}</div>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>New Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="Enter your new email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingEmail || !newEmail || newEmail === currentEmail}
                className="rounded-xl bg-[#29b6f6] px-6 py-3 text-[14px] font-semibold text-[#004460] tracking-[0.7px] transition-colors hover:bg-[#2196f3] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEmail ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordUpdate} className={cardClass}>
            <div className="flex items-center gap-4">
              <span className="material-symbols-rounded text-[28px] text-[#29b6f6]">lock</span>
              <h2 className="text-[24px] font-semibold text-[#0f172a] leading-8">Update Password</h2>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
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
              </div>

              <div className="flex gap-3 rounded-xl bg-[#f2f4f6] p-4">
                <span className="material-symbols-rounded mt-0.5 text-[14px] text-[#5f5e5e]">info</span>
                <p className="text-[12px] leading-[18px] text-[#5f5e5e]">
                  Security Tip: Use a combination of uppercase letters, numbers, and symbols to create a robust password.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="rounded-xl bg-[#29b6f6] px-8 py-3 text-[14px] font-semibold text-[#004460] tracking-[0.7px] transition-colors hover:bg-[#2196f3] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] font-semibold text-[#00658d] tracking-[0.7px] transition-colors hover:text-[#004460]"
              >
                Forgot current password?
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
