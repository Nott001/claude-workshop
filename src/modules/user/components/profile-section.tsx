"use client";

import { TextField } from "@/shared/components/text-field";
import { SettingsCard } from "@/modules/user/components/settings-card";
import { ProfilePhotoSection } from "@/modules/user/components/profile-photo-section";
import { profileNameHint } from "@/modules/user/lib/profile-name-hint";
import type { useAccountSettings } from "@/modules/user/lib/use-account-settings";
import type { UserRole } from "@/shared/types";

interface ProfileSectionProps {
  profile: ReturnType<typeof useAccountSettings>["profile"];
  photo: ReturnType<typeof useAccountSettings>["photo"];
  email?: string | null;
  /** Decides which surfaces the name hint names. */
  role?: UserRole;
}

/**
 * Photo and name in one card, because they are one idea — who the account
 * belongs to. The photo writes on selection rather than on save: an upload has
 * already left the browser by the time the menu closes, and a Save that
 * pretended otherwise would be lying about what it was waiting for.
 */
export function ProfileSection({ profile, photo, email, role }: ProfileSectionProps) {
  return (
    <SettingsCard
      id="profile"
      icon="person"
      title="Profile"
      description="Your name and photo, as everyone else sees them."
      footer={{
        onSave: profile.save,
        label: "Save profile",
        dirty: profile.dirty,
        saving: profile.saving,
        saved: profile.saved ? "Profile saved" : null,
      }}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <ProfilePhotoSection
            previewUrl={photo.url}
            uploading={photo.uploading}
            deleting={photo.deleting}
            onChange={photo.change}
            onDelete={photo.remove}
          />
          <div className="sm:hidden">
            <p className="text-sm font-bold text-fg">{profile.name}</p>
            <p className="text-xs text-muted-fg">{email}</p>
          </div>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <TextField
            id="profile-name"
            label="Name"
            type="text"
            autoComplete="name"
            value={profile.name}
            onChange={profile.setName}
            error={profile.nameError}
            hint={profileNameHint(role)}
          />
          {/* Read-only here: the address is changed one card down, where the
              verification it needs lives. */}
          <TextField id="profile-email" label="Account email" value={email ?? ""} onChange={() => {}} disabled />
        </div>
      </div>
    </SettingsCard>
  );
}
