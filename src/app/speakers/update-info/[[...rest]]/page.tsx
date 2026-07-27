"use client";

import Link from "next/link";
import { Footer } from "@/components/footer";
import { Toast } from "@/components/toast";
import { useSpeakerUpdateInfo } from "@/modules/speakers/lib/use-speaker-update-info";

const cardClass = "rounded-xl border border-border bg-surface p-[33px] flex flex-col gap-6";
const labelClass = "text-[14px] font-semibold text-muted-fg tracking-[0.7px] leading-4";
const inputClass =
  "w-full rounded-xl border border-border bg-surface px-[17px] py-[15px] text-base text-fg outline-none transition-colors placeholder:text-muted-fg focus:border-ring focus:ring-1 focus:ring-ring";

export default function SpeakerUpdateInfoPage() {
  const {
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
  } = useSpeakerUpdateInfo();

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

            <div className="pt-2">
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

      <Footer role="speaker" />
    </div>
  );
}
