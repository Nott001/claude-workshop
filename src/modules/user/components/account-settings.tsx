"use client";

import { Toast } from "@/shared/components/toast";
import { Button } from "@/shared/components/button";
import { Form } from "@/shared/components/form";
import { useAccountSettings } from "@/modules/user/lib/use-account-settings";
import { ProfilePhotoSection } from "@/modules/user/components/profile-photo-section";
import { ProfileNameSection } from "@/modules/user/components/profile-name-section";
import { EmailSection } from "@/modules/user/components/email-section";
import { PasswordSection } from "@/modules/user/components/password-section";
import { SpeakerProfileSection } from "@/modules/user/components/speaker-profile-section";
import { BackLink } from "@/shared/components/back-link";

export function AccountSettings() {
  const settings = useAccountSettings();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[896px] px-4 py-8 sm:px-6">
        <BackLink href="/" className="mb-6">
          Back to Home
        </BackLink>
        <h1 className="text-[32px] font-bold tracking-[-0.32px] text-fg leading-[40px]">Account Settings</h1>
        <p className="mt-1 text-base text-muted-fg leading-6">Manage your account, security, and profile.</p>

        {/* One form, one tray: the photo anchor, then the account fields, then —
            for speakers only — the professional info block, all saving through
            the single button at the foot. */}
        <Form onSubmit={settings.saveChanges} className="mt-8">
          <div className="overflow-hidden rounded-xl border border-border bg-surface divide-y divide-border">
            <div className="flex items-center gap-4 p-6">
              <ProfilePhotoSection
                previewUrl={settings.currentUser?.profile_image_url}
                uploading={settings.uploading}
                deleting={settings.deleting}
                onChange={settings.changeProfilePhoto}
                onDelete={settings.deleteProfilePhoto}
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-fg">{settings.currentUser?.full_name ?? ""}</p>
                <p className="text-xs text-muted-fg">Profile photo</p>
              </div>
            </div>
            <div className="p-6">
              <ProfileNameSection name={settings.name} onChange={settings.setName} error={settings.nameError} />
            </div>
            <div className="p-6">
              <EmailSection
                currentEmail={settings.currentUser?.email}
                newEmail={settings.newEmail}
                onChange={settings.setNewEmail}
                emailError={settings.emailError}
                emailSent={settings.emailSent}
                saving={settings.savingEmail}
                resendIn={settings.resendIn}
                onResend={settings.resendVerification}
                onCancel={settings.cancelEmailChange}
                emailVerified={settings.emailVerified}
                onDismissVerified={settings.dismissEmailVerified}
              />
            </div>
            <div className="p-6">
              <PasswordSection
                currentPassword={settings.currentPassword}
                onCurrentPasswordChange={settings.setCurrentPassword}
                currentPasswordError={settings.currentPasswordError}
                newPassword={settings.newPassword}
                onNewPasswordChange={settings.setNewPassword}
                newPasswordError={settings.newPasswordError}
                context={{ email: settings.currentUser?.email, fullName: settings.currentUser?.full_name }}
              />
            </div>
            {settings.isSpeaker && (
              <div className="p-6">
                <SpeakerProfileSection
                  loading={settings.speakerProfileId === undefined}
                  designation={settings.designation}
                  onDesignationChange={settings.setDesignation}
                  bio={settings.bio}
                  onBioChange={settings.setBio}
                  linkedinUrl={settings.linkedinUrl}
                  onLinkedinUrlChange={settings.setLinkedinUrl}
                  twitterUrl={settings.twitterUrl}
                  onTwitterUrlChange={settings.setTwitterUrl}
                  githubUrl={settings.githubUrl}
                  onGithubUrlChange={settings.setGithubUrl}
                  websiteUrl={settings.websiteUrl}
                  onWebsiteUrlChange={settings.setWebsiteUrl}
                  errors={settings.speakerFieldErrors}
                />
              </div>
            )}
          </div>
          {settings.savedNotice && (
            <div className="mt-6 flex items-start gap-2 rounded-lg bg-success/10 p-3">
              <span className="material-symbols-rounded mt-0.5 text-sm text-success">check_circle</span>
              <p className="flex-1 text-xs text-muted-fg">{settings.savedNotice}</p>
              <button
                type="button"
                onClick={settings.dismissSavedNotice}
                aria-label="Dismiss"
                className="material-symbols-rounded text-sm text-muted-fg hover:text-fg"
              >
                close
              </button>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={!settings.dirty || settings.saving}>
              {settings.saving ? "Saving\u2026" : "Save Changes"}
            </Button>
          </div>
        </Form>
      </div>

      {settings.toast && (
        <div className="fixed bottom-4 right-8 z-50">
          <Toast
            key={settings.toast.id}
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
