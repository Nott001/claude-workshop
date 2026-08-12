"use client";

import Link from "next/link";
import { Toast } from "@/shared/components/toast";
import { useAccountSettings } from "@/modules/user/lib/use-account-settings";
import { useSpeakerProfile } from "@/modules/user/lib/use-speaker-profile";
import { ProfilePhotoSection } from "@/modules/user/components/profile-photo-section";
import { ProfileNameSection } from "@/modules/user/components/profile-name-section";
import { EmailSection } from "@/modules/user/components/email-section";
import { PasswordSection } from "@/modules/user/components/password-section";
import { SpeakerProfileSection } from "@/modules/user/components/speaker-profile-section";

export function AccountSettings() {
  const settings = useAccountSettings();
  const speaker = useSpeakerProfile(settings.notify);

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
          <ProfilePhotoSection
            previewUrl={settings.currentUser?.profile_image_url}
            uploading={settings.uploading}
            onChange={settings.changeProfilePhoto}
          />
          <ProfileNameSection
            name={settings.name}
            onChange={settings.setName}
            saving={settings.savingName}
            onSubmit={settings.saveName}
          />
          <EmailSection
            currentEmail={settings.currentUser?.email}
            newEmail={settings.newEmail}
            onChange={settings.setNewEmail}
            emailSent={settings.emailSent}
            saving={settings.savingEmail}
            onSubmit={settings.changeEmail}
            resendIn={settings.resendIn}
            onResend={settings.resendVerification}
            onUseDifferent={settings.useDifferentEmail}
          />
          <PasswordSection
            currentPassword={settings.currentPassword}
            onCurrentPasswordChange={settings.setCurrentPassword}
            newPassword={settings.newPassword}
            onNewPasswordChange={settings.setNewPassword}
            saving={settings.savingPassword}
            onSubmit={settings.changePassword}
            context={{ email: settings.currentUser?.email, fullName: settings.currentUser?.full_name }}
          />
          {speaker.isSpeaker && (
            <SpeakerProfileSection
              loading={speaker.speakerProfileId === undefined}
              designation={speaker.designation}
              onDesignationChange={speaker.setDesignation}
              bio={speaker.bio}
              onBioChange={speaker.setBio}
              linkedinUrl={speaker.linkedinUrl}
              onLinkedinUrlChange={speaker.setLinkedinUrl}
              twitterUrl={speaker.twitterUrl}
              onTwitterUrlChange={speaker.setTwitterUrl}
              githubUrl={speaker.githubUrl}
              onGithubUrlChange={speaker.setGithubUrl}
              websiteUrl={speaker.websiteUrl}
              onWebsiteUrlChange={speaker.setWebsiteUrl}
              saving={speaker.savingSpeaker}
              onSubmit={speaker.saveSpeakerProfile}
            />
          )}
        </div>
      </div>

      {settings.toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast
            title={settings.toast.title}
            description={settings.toast.description}
            type={settings.toast.type}
            onClose={settings.dismissToast}
          />
        </div>
      )}
    </div>
  );
}
