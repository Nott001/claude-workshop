"use client";

import { useState } from "react";
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

export default function UserSettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const currentEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";

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
        <p className="mt-1 text-base text-[#5f5e5e] leading-6">Manage your name, email, and password.</p>

        <div className="mt-8 flex w-full flex-col gap-8">
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
