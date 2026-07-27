"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/modules/auth";
import { Toast } from "@/components/toast";
import { SpeakerProfileSection } from "@/modules/auth/ui/speaker-profile-section";
import { ProfileNameForm } from "@/modules/auth/ui/profile-name-form";
import { PasswordUpdateForm } from "@/modules/auth/ui/password-update-form";

type ToastData = { title: string; description: string; type: "success" | "error" };

export default function UserSettingsPage() {
  const { user: currentUser } = useSession();
  const userRole = currentUser?.role ?? null;
  const fullName = currentUser?.full_name ?? "";
  const [toast, setToast] = useState<ToastData | null>(null);
  const isSpeaker = userRole === "speaker";

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
          {isSpeaker && <SpeakerProfileSection onToast={setToast} />}

          <ProfileNameForm initialName={fullName} onToast={setToast} />
          <PasswordUpdateForm onToast={setToast} />
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
