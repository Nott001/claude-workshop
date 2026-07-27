"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useReverification, useClerk } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Footer } from "@/components/footer";
import { Toast } from "@/components/toast";

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";
const readOnlyInputClass = "w-full rounded-xl border border-border bg-muted px-[17px] py-[13px] text-base text-muted-fg";

type ToastData = { title: string; description: string; type: "success" | "error" };

export default function SpeakerUpdateInfoPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingEmail, setSavingEmail] = useState(false);
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
        setToast({
          title: "Role Updated",
          description: "Your professional role has been saved.",
          type: "success",
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({
          title: "Update Failed",
          description: data.error ?? "Unable to update role.",
          type: "error",
        });
      }
    } catch (err: any) {
      setToast({
        title: "Update Failed",
        description: err?.message ?? "Unable to update role.",
        type: "error",
      });
    }
    setSavingRole(false);
  }

  const currentEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";

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
    router.push("/sign-in?redirect_url=/speakers/settings");
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

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-16 pb-12">
        <div className="mb-12 max-w-[896px] w-full">
          <Link
            href="/speakers/settings"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand transition-colors hover:text-brand"
          >
            <span className="material-symbols-rounded text-[18px]">arrow_back</span>
            Back to Settings
          </Link>
          <h1 className="text-[32px] font-bold tracking-[-0.32px] text-fg leading-[40px]">Account Settings</h1>
          <p className="mt-1 text-base text-muted-fg leading-6">Manage your security credentials and professional identity.</p>
        </div>

        <div className="flex max-w-[800px] w-full flex-col gap-8">
          <form onSubmit={handleEmailUpdate} className={cardClass}>
            <div className="flex items-center gap-4">
              <span className="material-symbols-rounded text-[28px] text-brand">mail</span>
              <h2 className="text-[24px] font-semibold text-fg leading-8">Update Email Address</h2>
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
                className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEmail ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          <form onSubmit={handleRoleUpdate} className={cardClass}>
            <div className="flex items-center gap-4">
              <span className="material-symbols-rounded text-[28px] text-brand">badge</span>
              <h2 className="text-[24px] font-semibold text-fg leading-8">Professional Role</h2>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>Role / Designation</label>
              <input
                type="text"
                placeholder="e.g. Lead Instructor, Professor, Industry Expert"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputClass}
              />
              <p className="text-[12px] leading-[18px] text-muted-fg">
                This will be displayed publicly on event pages and speaker cards.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingRole}
                className="rounded-xl bg-brand px-6 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingRole ? "Saving..." : "Save Role"}
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
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="rounded-xl bg-brand px-8 py-3 text-[14px] font-semibold text-brand-fg tracking-[0.7px] transition-colors hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] font-semibold text-brand tracking-[0.7px] transition-colors hover:text-brand"
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

      <Footer role="speaker" />
    </div>
  );
}
